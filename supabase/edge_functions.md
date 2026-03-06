# Supabase Edge Functions

Last updated: 2026-03-06

## Active Edge Functions

### 1. feishu-callback (login-processor)

**Function ID**: bac94abe-93c9-49c7-95ba-65b5a98b1efd
**Slug**: login-processor
**Display Name**: feishu-callback
**Status**: ACTIVE
**Version**: 18
**JWT Verification**: Disabled (verify_jwt: false)

#### Purpose
Handles Feishu (Lark) OAuth callback for user authentication. This function processes the OAuth authorization code, exchanges it for user information, and creates or updates Supabase user accounts with Feishu integration.

#### Environment Variables Required
- `FEISHU_APP_ID`: Feishu application ID
- `FEISHU_APP_SECRET`: Feishu application secret
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for admin operations
- `FEISHU_LOGIN_REDIRECT_TO` (optional): Desktop redirect URL after login
- `FEISHU_LOGIN_REDIRECT_TO_MOBILE` (optional): Mobile redirect URL, default: 'canmou://auth-callback'

#### Request Parameters
- `code` (query param, required): OAuth authorization code from Feishu
- `state` (query param, optional): OAuth state parameter for CSRF protection
- `platform` (query param, optional): Platform type ('mobile' or 'desktop') to determine redirect URL

#### Authentication Flow
1. Validates required environment variables
2. Exchanges authorization code for Feishu app access token
3. Uses app token to get user access token
4. Fetches user information from Feishu API
5. Creates or updates Supabase user account
6. Upserts user profile in public.profiles table
7. Generates magic link for session creation
8. Redirects user to the magic link URL

#### Response
- **Success**: HTTP 302 redirect to Supabase magic link
- **Error**: JSON response with error details and appropriate HTTP status code

#### Error Handling
- Missing environment variables: 500
- Missing authorization code: 400
- Feishu API failures: 502
- Supabase operation failures: 500
- Unexpected errors: 500

#### Security Notes
- JWT verification is disabled for this function as it handles initial authentication
- Uses service role key for admin operations (user creation/update)
- TODO: Implement state parameter validation for CSRF protection

#### Integration Points
- **Feishu APIs**:
  - `/open-apis/auth/v3/app_access_token/internal`: Get app token
  - `/open-apis/authen/v1/oidc/access_token`: Exchange code for user token
  - `/open-apis/authen/v1/user_info`: Get user information
- **Supabase**:
  - `auth.admin.listUsers()`: Check existing users
  - `auth.admin.createUser()`: Create new user
  - `auth.admin.updateUserById()`: Update user metadata
  - `auth.admin.generateLink()`: Generate magic link
  - `from('profiles').upsert()`: Sync user profile

#### File Structure
```
supabase/functions/feishu-callback/
└── index.ts
```

---

## Function Deployment Information

**Last Updated**: 2026-03-06 (Version 18)
**SHA256**: 2b198556172aebe37fd0f052a521a494ee229497fdddcbf9c52f388457ef0c00

## Notes
- The function uses Deno runtime with TypeScript
- Dependencies are loaded from ESM CDN (esm.sh)
- No import map is configured
- Function is production-ready and actively handling authentication
