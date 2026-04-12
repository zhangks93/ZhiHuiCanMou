# Codebase Map: Concerns

## Highest-Risk Technical Areas

### Authentication Complexity

- Auth spans Feishu, Supabase, edge functions, browser callback parsing, desktop deep-link handling, and Tauri event forwarding.
- Relevant files:
  - `supabase/functions/feishu-callback/index.ts`
  - `supabase/functions/feishu-refresh/index.ts`
  - `app/src/features/auth/pages/AuthCallbackPage.tsx`
  - `app/src/features/auth/services/authSessionService.ts`
  - `app/src/features/auth/services/tauriOAuthService.ts`
  - `app/src-tauri/src/lib.rs`
- This is the most likely area for race conditions, platform-specific bugs, and difficult-to-debug production failures.

### Agent Runtime Concentration

- `app/src/shared/lib/agent/chatAgent.ts` is large and operationally central.
- It mixes transport concerns, provider branching, stream parsing, loop protection, caching, truncation, and tool orchestration in one class.
- That concentration raises maintenance cost and increases regression risk for future model/provider changes.

### Security Posture

- `supabase/functions/feishu-callback/index.ts` notes that state validation is effectively delegated to the client, leaving server-side CSRF guarantees weaker than they should be.
- `app/src-tauri/tauri.conf.json` sets CSP to `null`.
- `app/src/features/agent-chat/components/ChatMarkdown.tsx` uses permissive inline CSP rules to support rendered previews.
- These are workable during rapid iteration, but they expand attack surface in a desktop app that can render model output.

### Testing Deficit

- There is no visible automated test suite for the most brittle code paths.
- Platform-specific auth and agent streaming logic are exactly the places where automated regression coverage would pay back quickly.

## Medium-Risk Areas

### Repository Hygiene

- Generated Android output is committed under `app/src-tauri/gen/android/`.
- Operational spreadsheets and generated chart assets live in the repo under `docs/data/` and `scripts/report_pngs/`.
- `scripts/__pycache__/` is present in source control.
- These increase noise, slow reviews, and make architecture signals harder to read.

### Incomplete Or Uneven Feature Slices

- The repo contains a `app/src/features/dashboard/` directory shell with no obvious implementation files.
- Some features follow `api/hooks/pages/components`, while others are thinner or inconsistent.
- That suggests ongoing restructuring or incomplete migration, which can produce dead paths and stale assumptions.

### Direct SDK Coupling

- Feature code appears to call Supabase directly without an intermediate backend service boundary.
- That is efficient early on, but it can make permission logic, caching, and query optimization harder to centralize later.

## Lower-Level Code Smells Observed

- Rust code in `app/src-tauri/src/lib.rs` uses `unwrap_or("")` and recursive retry flow in a spawned thread; this is simple but not especially structured.
- Edge function user lookup currently calls `auth.admin.listUsers({ perPage: 1000 })` then scans in memory, which does not scale well.
- The frontend relies heavily on `console.*` diagnostics, indicating observability is still in a local-debugging stage.

## Optimization-Relevant Signals

- Agent chat already includes token-budget and repeated-tool protections, which shows performance pressure is real and actively managed.
- Conversation persistence has started externalizing artifact payloads, indicating local storage size and memory footprint were already pain points.
- The codebase likely has the most optimization leverage in:
  - auth simplification
  - agent runtime decomposition
  - data query boundaries
  - automated verification

## Immediate Mapping Conclusion

- The project is viable and reasonably organized, but it is carrying complexity in exactly the areas the user asked to optimize: performance-sensitive agent orchestration, code structure, and stability-critical auth/runtime flows.
- A future optimization phase should treat auth reliability, agent modularization, and test/verification infrastructure as first-tier work rather than cleanup.
