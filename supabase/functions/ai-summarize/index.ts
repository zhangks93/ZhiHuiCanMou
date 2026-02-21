// Edge Function: AI work summary
// Summarizes work_items for managers. Uses OPENAI_API_KEY if set, else returns template-based summary.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

interface WorkItemInput {
  module_id: string
  content?: string | null
  links?: { url: string; title?: string }[]
  reporter_name?: string | null
  period_start?: string | null
  period_end?: string | null
}

function buildTemplateSummary(items: WorkItemInput[]): string {
  if (items.length === 0) return '暂无下属汇报数据。'
  const byModule = items.reduce<Record<string, WorkItemInput[]>>((acc, i) => {
    const k = i.module_id || 'other'
    if (!acc[k]) acc[k] = []
    acc[k].push(i)
    return acc
  }, {})
  const parts: string[] = []
  for (const [mod, modItems] of Object.entries(byModule)) {
    parts.push(`【${mod}】`)
    for (const it of modItems) {
      const who = it.reporter_name ? `${it.reporter_name}：` : ''
      parts.push(`- ${who}${it.content || '（无说明）'}`)
      if (Array.isArray(it.links) && it.links.length > 0) {
        parts.push(`  附链接 ${it.links.length} 个`)
      }
    }
  }
  return parts.join('\n')
}

async function callOpenAI(items: WorkItemInput[]): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return buildTemplateSummary(items)

  const raw = JSON.stringify(
    items.map((i) => ({
      module: i.module_id,
      reporter: i.reporter_name,
      content: i.content,
      links: i.links,
      period: `${i.period_start}~${i.period_end}`,
    }))
  )

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            '你是一位企业数字秘书，负责汇总下属工作汇报。请用简洁、结构化的方式总结以下工作进展，提炼关键信息与待跟进事项。输出为中文。',
        },
        {
          role: 'user',
          content: `请汇总以下工作汇报：\n${raw}`,
        },
      ],
      max_tokens: 1500,
    }),
  })

  if (!res.ok) {
    console.warn('[ai-summarize] OpenAI API error:', await res.text())
    return buildTemplateSummary(items)
  }

  const json = await res.json()
  const choice = json?.choices?.[0]
  return choice?.message?.content?.trim() || buildTemplateSummary(items)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const workItems = body.work_items as WorkItemInput[] | undefined

    if (!Array.isArray(workItems)) {
      return jsonResponse(
        { error: 'Missing or invalid work_items array' },
        400
      )
    }

    const summary = await callOpenAI(workItems)

    return jsonResponse({
      summary,
      item_count: workItems.length,
    })
  } catch (e) {
    console.error('[ai-summarize] Error:', e)
    return jsonResponse(
      { error: 'Internal server error', detail: String(e) },
      500
    )
  }
})
