import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type FeishuUserInfo = {
  open_id: string
  name: string
  enterprise_email?: string
  avatar_url?: string
}

const FEISHU_APP_ID = Deno.env.get('FEISHU_APP_ID') ?? ''
const FEISHU_APP_SECRET = Deno.env.get('FEISHU_APP_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const LOGIN_REDIRECT_TO = Deno.env.get('FEISHU_LOGIN_REDIRECT_TO') || undefined

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  try {
    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
      return jsonResponse(
        { error: 'Missing FEISHU_APP_ID or FEISHU_APP_SECRET env vars' },
        500
      )
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(
        { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars' },
        500
      )
    }

    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code) {
      return jsonResponse({ error: 'Missing code in query string' }, 400)
    }

    // TODO: 校验 state（可结合 cookie / storage），这里仅透传

    // Step 1: 获取 app_access_token
    const appTokenRes = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          app_id: FEISHU_APP_ID,
          app_secret: FEISHU_APP_SECRET,
        }),
      }
    )

    const appTokenJson = await appTokenRes.json()
    if (!appTokenRes.ok || appTokenJson.code !== 0) {
      return jsonResponse(
        {
          error: 'Failed to get Feishu app_access_token',
          detail: appTokenJson,
        },
        502
      )
    }

    const app_access_token: string = appTokenJson.app_access_token

    // Step 2: 用 code 换 user access_token
    const userTokenRes = await fetch(
      'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${app_access_token}`,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
        }),
      }
    )

    const userTokenJson = await userTokenRes.json()
    if (!userTokenRes.ok || userTokenJson.code !== 0) {
      return jsonResponse(
        {
          error: 'Failed to get Feishu user access_token',
          detail: userTokenJson,
        },
        502
      )
    }

    const access_token: string = userTokenJson.data?.access_token
    if (!access_token) {
      return jsonResponse(
        { error: 'Feishu access_token missing in response' },
        502
      )
    }

    // Step 3: 获取用户信息
    const userInfoRes = await fetch(
      'https://open.feishu.cn/open-apis/authen/v1/user_info',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    )

    const userInfoJson = await userInfoRes.json()
    if (!userInfoRes.ok || userInfoJson.code !== 0) {
      return jsonResponse(
        {
          error: 'Failed to get Feishu user info',
          detail: userInfoJson,
        },
        502
      )
    }

    const feishuUser: FeishuUserInfo = userInfoJson.data

    // Step 4: 使用 Supabase Admin API 同步 / 登录用户
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const email =
      feishuUser.enterprise_email ||
      `${feishuUser.open_id}@feishu.local`.toLowerCase()

    // 查找是否已有用户（根据 email 或 feishu_open_id）
    const { data: listData, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })

    if (listError) {
      return jsonResponse(
        { error: 'Failed to list Supabase users', detail: listError },
        500
      )
    }

    const feishuMetadata = {
      feishu_open_id: feishuUser.open_id,
      name: feishuUser.name,
      avatar: feishuUser.avatar_url,
      feishu_state: state,
    }

    const existingUser =
      listData?.users?.find(
        (u: { email?: string; user_metadata?: { feishu_open_id?: string } }) =>
          u.email === email ||
          (u.user_metadata?.feishu_open_id === feishuUser.open_id)
      ) ?? null

    let supabaseUserId: string

    if (!existingUser) {
      const { data: createData, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: feishuMetadata,
        })

      if (createError) {
        return jsonResponse(
          { error: 'Failed to create Supabase user', detail: createError },
          500
        )
      }
      supabaseUserId = createData.user.id
    } else {
      supabaseUserId = existingUser.id
      // Update existing user's metadata with latest Feishu info
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: feishuMetadata,
      })
    }

    // Upsert profile: save feishu_open_id to public.profiles for querying and RLS
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: supabaseUserId,
          feishu_open_id: feishuUser.open_id,
          name: feishuUser.name,
          avatar_url: feishuUser.avatar_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

    if (profileError) {
      // Log but don't fail login - auth still works, profile is optional
      console.error('Failed to upsert profile:', profileError)
    }

    // 生成 magic link / 会话
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          data: {
            feishu_open_id: feishuUser.open_id,
            name: feishuUser.name,
            avatar: feishuUser.avatar_url,
          },
          redirectTo: LOGIN_REDIRECT_TO,
        },
      })

    const actionLink =
      (linkData as any)?.action_link ??
      (linkData as any)?.properties?.action_link ??
      null

    if (linkError || !actionLink) {
      return jsonResponse(
        {
          error: 'Failed to generate Supabase magic link',
          detail: linkError ?? linkData,
        },
        500
      )
    }

    // 重定向到 Supabase 生成的 magic link
    return Response.redirect(actionLink, 302)
  } catch (e) {
    console.error('feishu-callback error:', e)
    return jsonResponse(
      { error: 'Unexpected error in feishu-callback', detail: String(e) },
      500
    )
  }
})

