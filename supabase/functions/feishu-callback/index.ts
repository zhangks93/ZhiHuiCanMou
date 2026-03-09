import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type FeishuUserInfo = {
  open_id: string
  name: string
  enterprise_email?: string
  avatar_url?: string
}

// Error codes for structured error handling
const ERROR_CODES = {
  MISSING_ENV: 'AUTH_001',
  MISSING_CODE: 'AUTH_002',
  MISSING_STATE: 'AUTH_003',
  FEISHU_APP_TOKEN_FAILED: 'AUTH_004',
  FEISHU_USER_TOKEN_FAILED: 'AUTH_005',
  FEISHU_USER_INFO_FAILED: 'AUTH_006',
  SUPABASE_LIST_USERS_FAILED: 'AUTH_007',
  SUPABASE_CREATE_USER_FAILED: 'AUTH_008',
  SUPABASE_MAGIC_LINK_FAILED: 'AUTH_009',
  UNEXPECTED_ERROR: 'AUTH_999',
}

const FEISHU_APP_ID = Deno.env.get('FEISHU_APP_ID') ?? ''
const FEISHU_APP_SECRET = Deno.env.get('FEISHU_APP_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const LOGIN_REDIRECT_TO = Deno.env.get('FEISHU_LOGIN_REDIRECT_TO') || undefined
const LOGIN_REDIRECT_TO_MOBILE = Deno.env.get('FEISHU_LOGIN_REDIRECT_TO_MOBILE') || 'canmou://auth-callback'
const FEISHU_API_TIMEOUT = parseInt(Deno.env.get('FEISHU_API_TIMEOUT_MS') || '5000', 10)

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function errorResponse(code: string, message: string, detail?: unknown, status = 500) {
  return jsonResponse({ error: message, code, detail }, status)
}

Deno.serve(async (req) => {
  try {
    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
      return errorResponse(
        ERROR_CODES.MISSING_ENV,
        'Missing FEISHU_APP_ID or FEISHU_APP_SECRET env vars',
        undefined,
        500
      )
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return errorResponse(
        ERROR_CODES.MISSING_ENV,
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars',
        undefined,
        500
      )
    }

    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const platform = url.searchParams.get('platform') // 'mobile' or 'desktop'

    if (!code) {
      return errorResponse(
        ERROR_CODES.MISSING_CODE,
        'Missing code in query string',
        undefined,
        400
      )
    }

    if (!state) {
      return errorResponse(
        ERROR_CODES.MISSING_STATE,
        'Missing state parameter for CSRF protection',
        undefined,
        400
      )
    }

    // Note: State validation happens on client side (stored in sessionStorage)
    // The state is passed through to the client for validation

    // Step 1: 获取 app_access_token with timeout
    const appTokenController = new AbortController()
    const appTokenTimeout = setTimeout(() => appTokenController.abort(), FEISHU_API_TIMEOUT)

    const appTokenRes = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          app_id: FEISHU_APP_ID,
          app_secret: FEISHU_APP_SECRET,
        }),
        signal: appTokenController.signal,
      }
    )
    clearTimeout(appTokenTimeout)

    const appTokenJson = await appTokenRes.json()
    if (!appTokenRes.ok || appTokenJson.code !== 0) {
      return errorResponse(
        ERROR_CODES.FEISHU_APP_TOKEN_FAILED,
        'Failed to get Feishu app_access_token',
        appTokenJson,
        502
      )
    }

    const app_access_token: string = appTokenJson.app_access_token

    // Step 2: 用 code 换 user access_token with timeout
    const userTokenController = new AbortController()
    const userTokenTimeout = setTimeout(() => userTokenController.abort(), FEISHU_API_TIMEOUT)

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
        signal: userTokenController.signal,
      }
    )
    clearTimeout(userTokenTimeout)

    const userTokenJson = await userTokenRes.json()
    if (!userTokenRes.ok || userTokenJson.code !== 0) {
      return errorResponse(
        ERROR_CODES.FEISHU_USER_TOKEN_FAILED,
        'Failed to get Feishu user access_token',
        userTokenJson,
        502
      )
    }

    const access_token: string = userTokenJson.data?.access_token
    if (!access_token) {
      return errorResponse(
        ERROR_CODES.FEISHU_USER_TOKEN_FAILED,
        'Feishu access_token missing in response',
        undefined,
        502
      )
    }

    // Step 3: 获取用户信息 with timeout
    const userInfoController = new AbortController()
    const userInfoTimeout = setTimeout(() => userInfoController.abort(), FEISHU_API_TIMEOUT)

    const userInfoRes = await fetch(
      'https://open.feishu.cn/open-apis/authen/v1/user_info',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        signal: userInfoController.signal,
      }
    )
    clearTimeout(userInfoTimeout)

    const userInfoJson = await userInfoRes.json()
    if (!userInfoRes.ok || userInfoJson.code !== 0) {
      return errorResponse(
        ERROR_CODES.FEISHU_USER_INFO_FAILED,
        'Failed to get Feishu user info',
        userInfoJson,
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
      return errorResponse(
        ERROR_CODES.SUPABASE_LIST_USERS_FAILED,
        'Failed to list Supabase users',
        listError,
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
        return errorResponse(
          ERROR_CODES.SUPABASE_CREATE_USER_FAILED,
          'Failed to create Supabase user',
          createError,
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

    // Default org for single-tenant (from migration 20250221000000)
    const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'

    // Parallel execution: Upsert profile and generate magic link simultaneously
    const redirectUrl = platform === 'mobile' ? LOGIN_REDIRECT_TO_MOBILE : LOGIN_REDIRECT_TO

    const [profileResult, linkResult] = await Promise.all([
      // Upsert profile: save feishu_open_id to public.profiles for querying and RLS
      supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: supabaseUserId,
            feishu_open_id: feishuUser.open_id,
            name: feishuUser.name,
            avatar_url: feishuUser.avatar_url,
            org_id: DEFAULT_ORG_ID,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        ),
      // 生成 magic link / 会话
      supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          data: {
            feishu_open_id: feishuUser.open_id,
            name: feishuUser.name,
            avatar: feishuUser.avatar_url,
          },
          redirectTo: redirectUrl,
        },
      }),
    ])

    // Check profile upsert result (non-critical)
    if (profileResult.error) {
      // Log but don't fail login - auth still works, profile is optional
      console.error('Failed to upsert profile:', profileResult.error)
    }

    // Check magic link generation result (critical)
    const { data: linkData, error: linkError } = linkResult

    const actionLink =
      (linkData as any)?.action_link ??
      (linkData as any)?.properties?.action_link ??
      null

    if (linkError || !actionLink) {
      return errorResponse(
        ERROR_CODES.SUPABASE_MAGIC_LINK_FAILED,
        'Failed to generate Supabase magic link',
        linkError ?? linkData,
        500
      )
    }

    // 重定向到 Supabase 生成的 magic link
    return Response.redirect(actionLink, 302)
  } catch (e) {
    console.error('feishu-callback error:', e)
    return errorResponse(
      ERROR_CODES.UNEXPECTED_ERROR,
      'Unexpected error in feishu-callback',
      String(e),
      500
    )
  }
})
