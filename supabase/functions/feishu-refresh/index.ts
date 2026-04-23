import { createClient } from 'npm:@supabase/supabase-js@2'

// Error codes for structured error handling
const ERROR_CODES = {
  MISSING_ENV: 'REFRESH_001',
  MISSING_REFRESH_TOKEN: 'REFRESH_002',
  INVALID_REFRESH_TOKEN: 'REFRESH_003',
  FEISHU_REFRESH_FAILED: 'REFRESH_004',
  SUPABASE_UPDATE_FAILED: 'REFRESH_005',
  UNEXPECTED_ERROR: 'REFRESH_999',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const FEISHU_APP_ID = Deno.env.get('FEISHU_APP_ID') ?? ''
const FEISHU_APP_SECRET = Deno.env.get('FEISHU_APP_SECRET') ?? ''

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
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return errorResponse(
        ERROR_CODES.MISSING_ENV,
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars',
        undefined,
        500
      )
    }

    if (!FEISHU_APP_ID || !FEISHU_APP_SECRET) {
      return errorResponse(
        ERROR_CODES.MISSING_ENV,
        'Missing FEISHU_APP_ID or FEISHU_APP_SECRET env vars',
        undefined,
        500
      )
    }

    // Get refresh token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(
        ERROR_CODES.MISSING_REFRESH_TOKEN,
        'Missing or invalid Authorization header',
        undefined,
        401
      )
    }

    const token = authHeader.substring(7)

    // Parse request body for refresh token (alternative method)
    let refreshToken: string | null = null
    try {
      const body = await req.json()
      refreshToken = body.refresh_token || token
    } catch {
      refreshToken = token
    }

    if (!refreshToken) {
      return errorResponse(
        ERROR_CODES.MISSING_REFRESH_TOKEN,
        'Missing refresh_token',
        undefined,
        400
      )
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify the refresh token with Supabase
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (sessionError || !sessionData.session) {
      return errorResponse(
        ERROR_CODES.INVALID_REFRESH_TOKEN,
        'Invalid or expired refresh token',
        sessionError,
        401
      )
    }

    // Note: Feishu OAuth tokens are typically long-lived and don't need frequent refresh
    // The Supabase session refresh is sufficient for most cases
    // If Feishu-specific token refresh is needed, implement it here

    // Return new session tokens
    return jsonResponse({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_in: sessionData.session.expires_in,
      expires_at: sessionData.session.expires_at,
      user: sessionData.session.user,
    })
  } catch (e) {
    console.error('feishu-refresh error:', e)
    return errorResponse(
      ERROR_CODES.UNEXPECTED_ERROR,
      'Unexpected error in feishu-refresh',
      String(e),
      500
    )
  }
})
