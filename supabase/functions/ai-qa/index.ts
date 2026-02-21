// Edge Function: Natural language Q&A over work context
// Manager asks a question; AI answers based on work_items context. Uses OPENAI_API_KEY if set.

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

async function callOpenAI(question: string, contextText: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    return '请在系统配置中设置 OPENAI_API_KEY 以启用自然语言追问功能。'
  }

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
            '你是一位企业数字秘书。根据提供的工作汇报上下文，简洁、准确地回答管理者的提问。若上下文中无相关信息，请如实说明。输出为中文。',
        },
        {
          role: 'user',
          content: `【工作汇报上下文】\n${contextText}\n\n【管理者提问】\n${question}`,
        },
      ],
      max_tokens: 800,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.warn('[ai-qa] OpenAI error:', err)
    return `调用 AI 失败：${res.status}`
  }

  const json = await res.json()
  return json?.choices?.[0]?.message?.content?.trim() ?? '暂无回答'
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

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const question = typeof body.question === 'string' ? body.question.trim() : ''

    if (!question) {
      return jsonResponse({ error: 'Missing question' }, 400)
    }

    const contextItems = body.context as Array<{
      module_id?: string
      content?: string | null
      reporter_name?: string | null
    }> | undefined

    let contextText = '（无工作汇报数据）'
    if (Array.isArray(contextItems) && contextItems.length > 0) {
      contextText = contextItems
        .map(
          (i) =>
            `[${i.reporter_name ?? '未知'}] ${i.module_id ?? ''}: ${i.content ?? '（无）'}`
        )
        .join('\n')
    }

    const answer = await callOpenAI(question, contextText)
    return jsonResponse({ answer })
  } catch (e) {
    console.error('[ai-qa] Error:', e)
    return jsonResponse({ error: 'Internal server error', detail: String(e) }, 500)
  }
})
