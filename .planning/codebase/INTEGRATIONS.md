# Codebase Map: Integrations

## Primary External Systems

- Supabase for auth, database access, and edge functions.
- Feishu for OAuth and organizational identity.
- LLM providers through configurable HTTP APIs in `app/src/shared/lib/llmConfig.ts` and `app/src/shared/lib/agent/chatAgent.ts`.
- GitHub Actions for release and Pages deployment.

## Supabase Integration

- Client bootstrap: `app/src/shared/lib/supabase.ts`
- Auth session lifecycle: `app/src/features/auth/services/authSessionService.ts`
- Feature repositories query Supabase tables in files such as:
  - `app/src/features/attendance/api/attendanceRepository.ts`
  - `app/src/features/biz-data/api/bizDataRepository.ts`
  - `app/src/features/opportunity/api/opportunityRepository.ts`
  - `app/src/features/org/api/orgRepository.ts`
  - `app/src/features/schedule/api/scheduleRepository.ts`
  - `app/src/features/trip/api/tripRepository.ts`

## Feishu OAuth Integration

- Browser/mobile and desktop callback handling live in:
  - `app/src/features/auth/pages/AuthCallbackPage.tsx`
  - `app/src/features/auth/services/authCallbackService.ts`
  - `app/src/features/auth/services/tauriOAuthService.ts`
- Native deep-link bridging happens in `app/src-tauri/src/lib.rs`.
- OAuth callback exchange is handled by `supabase/functions/feishu-callback/index.ts`.
- Token/session refresh fallback is exposed by `supabase/functions/feishu-refresh/index.ts`.

## Tauri Runtime Integration

- Tauri HTTP plugin is wrapped by `app/src/shared/lib/httpClient.ts`.
- Tauri event API is used for desktop OAuth completion in `app/src/features/auth/services/tauriOAuthService.ts`.
- Tauri deep-link plugin is used in `app/src-tauri/src/lib.rs`.
- Tauri opener/shell plugins are registered in Rust, enabling external navigation or OS-level actions when needed.

## Agent Tool Integrations

- Tool registry in `app/src/shared/lib/agent/tools/toolRegistry.ts` exposes:
  - `resolve_org_nodes`
  - `query_with_hierarchy`
  - `query_monthly_plan`
  - `query_biz_data`
  - `read_file`
- Tooling is tightly coupled to internal business datasets and markdown/reference assets rather than arbitrary external SaaS connectors.
- Asset registration for prompt attachments is handled in `app/src/shared/lib/agent/skills/loader.ts` and `app/src/shared/lib/agent/skills/assetRegistry.ts`.

## Data Import And Offline Content Inputs

- Excel and XLS source files are stored under `docs/data/`.
- Python import scripts load and transform those artifacts, for example:
  - `scripts/import_biz_data.py`
  - `scripts/import_opportunity_ledger.py`
  - `scripts/import_attendance.py`
  - `scripts/import_trips.py`
  - `scripts/sync_feishu_contacts.py`
- Generated chart image outputs are stored under `scripts/report_pngs/`.

## CI/CD Integrations

- Release workflow: `.github/workflows/build-release.yml`
- Pages workflows: `.github/workflows/pages.yml` and `.github/workflows/deploy-pages.yml`
- Build pipeline injects secrets like `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and Feishu env vars through GitHub Actions secrets.

## Security-Relevant Integration Notes

- `supabase/functions/feishu-callback/index.ts` requires service-role access and performs Supabase admin operations.
- The same callback file explicitly notes that server-side CSRF validation is not implemented; state is only validated on the client path.
- `app/src-tauri/tauri.conf.json` currently sets `"csp": null`, which means the desktop shell is not relying on a restrictive CSP.
- `app/src/features/agent-chat/components/ChatMarkdown.tsx` injects permissive CSP meta tags for sandboxed previews and allows `unsafe-inline`.

## Integration Observations

- The critical path for login crosses Feishu, Supabase Edge Functions, Supabase Auth, Tauri desktop events, and browser-side route handling.
- Business data access appears centralized through Supabase rather than a separate API server.
- The project currently favors direct SDK usage and repo-local scripts over a dedicated backend service boundary.
