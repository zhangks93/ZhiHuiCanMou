# Codebase Map: Testing

## Current Testing Posture

- No dedicated frontend or backend test framework is visible in `app/package.json`.
- Repository search did not surface `*.test.*`, `*.spec.*`, Vitest, Jest, Playwright, Cypress, or similar app-level suites.
- Current quality gates appear to rely on:
  - TypeScript compile/build via `npm run build`
  - ESLint via `npm run lint`
  - Manual runtime validation
  - Release pipeline builds in GitHub Actions

## Existing Verification Signals

- `app/package.json` defines `build`, `lint`, `tauri:dev`, and platform build scripts.
- `.github/workflows/build-release.yml` exercises multi-platform packaging for macOS, Linux, Windows, and Android.
- `scripts/browser-snapshot.js` suggests there is at least some browser automation tooling available, but it is not structured as a maintained test suite.
- Auth callback and agent code contain robust defensive branches, but those branches do not appear to be covered by automated tests.

## High-Risk Areas Without Visible Test Coverage

- OAuth callback parsing and retry behavior in:
  - `app/src/features/auth/pages/AuthCallbackPage.tsx`
  - `app/src/features/auth/services/authCallbackService.ts`
  - `app/src/features/auth/services/authSessionService.ts`
  - `app/src-tauri/src/lib.rs`
- Agent streaming/tool-call state machine in `app/src/shared/lib/agent/chatAgent.ts`
- Data aggregation and transformation in:
  - `app/src/features/biz-data/services/bizDataService.ts`
  - `app/src/shared/lib/agent/tools/queryBizData.ts`
  - `app/src/shared/lib/agent/tools/queryWithHierarchy.ts`
- Supabase Edge Functions in `supabase/functions/`

## Likely Manual Test Patterns

- Run Vite/Tauri locally and inspect pages manually.
- Validate auth flows with Feishu and deep links.
- Use spreadsheets and import scripts to check data ingestion.
- Build release artifacts through GitHub Actions to catch packaging regressions.

## Testing Gaps

- No unit tests for pure data transforms.
- No contract tests for Supabase queries or edge functions.
- No Tauri integration tests for deep-link and desktop auth behavior.
- No UI regression or interaction coverage for complex screens like agent chat or business data views.
- No observable coverage reports or CI test stage before release packaging.

## Recommended Test Entry Points For Future Mapping

- Add fast unit tests around agent helpers and data transformers first.
- Add auth callback parsing tests around edge cases and token/state handling.
- Add repository-level tests or mocks for Supabase query shaping.
- Add one or two end-to-end smoke tests for login and core page navigation.

## Bottom Line

- The codebase has build validation, not a mature automated testing layer.
- Release workflows are stronger than day-to-day regression detection.
- If this repo becomes more agent-centric and more desktop/mobile critical, test coverage will need to become a first-class concern.
