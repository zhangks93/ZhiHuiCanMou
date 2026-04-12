# Codebase Map: Conventions

## Language And Module Style

- TypeScript uses ES modules throughout the frontend and helper scripts.
- Path aliases use `@/` imports, for example in `app/src/app/router/routes.tsx` and `app/src/features/auth/services/authSessionService.ts`.
- Files mostly export named functions/components; default exports are limited to lazy route module loading patterns.

## React Conventions

- Functional components are standard across the UI.
- Hooks are colocated under feature directories when stateful feature logic grows beyond the page component.
- Route modules are lazy-loaded in `app/src/app/router/routes.tsx`.
- Context is used sparingly; auth is the clearest shared-context example in `app/src/app/providers/AuthProvider.tsx`.

## Service And Repository Conventions

- Data access generally lives under `api/` or `services/`.
- Feature pages call hooks or repositories instead of embedding all query code directly.
- Shared infra helpers like `app/src/shared/lib/httpClient.ts` and `app/src/shared/storage/createBrowserStore.ts` wrap low-level platform behavior.

## Error Handling Patterns

- Frontend code tends to prefer defensive logging with `console.warn`/`console.error` instead of throwing to a centralized handler.
- Auth flows use structured error helpers in `app/src/shared/lib/auth-errors.ts` and callback status UIs in `app/src/features/auth/pages/AuthCallbackPage.tsx`.
- Edge functions return structured JSON error codes via helper functions instead of raw thrown exceptions.
- Rust emits errors/events via logs and Tauri events rather than exposing typed command results.

## Agent Runtime Conventions

- `app/src/shared/lib/agent/chatAgent.ts` contains substantial guardrails:
  - max tool-call depth
  - cached result reuse
  - truncation/compaction for large tool payloads
  - provider-specific streaming branches
- Agent skill packaging convention is:
  - `skill.json`
  - `prompt.md`
  - `references/`
  - `assets/`
- Conversation persistence normalizes versioned structures in `app/src/shared/lib/agent/conversationStore.ts`.

## Storage Conventions

- Browser persistence is abstracted through `createBrowserStore` in `app/src/shared/storage/createBrowserStore.ts`.
- Agent conversations and artifact payloads are stored separately to reduce localStorage payload size.
- Legacy conversation migration is handled in-place for the `financial-analysis` agent.

## Styling Conventions

- Tailwind utility classes are used heavily in component markup.
- Design tokens supplement utility classes via CSS custom properties in `app/src/shared/styles/tokens.css`.
- Some pages, such as `app/src/features/auth/pages/AuthCallbackPage.tsx`, use elaborate inline utility compositions for motion and atmosphere.

## Documentation Conventions

- The repo includes handwritten markdown references for Supabase and skill prompts.
- There is an existing optimization note in `.claude/agent-ui-optimization.md`, indicating architecture decisions are sometimes documented informally outside the codebase map path.

## Convention Gaps

- Feature slice consistency is not complete; some areas have rich folder structure while others are page-only or partially scaffolded.
- Logging is mostly ad hoc and not standardized behind a single telemetry/logger abstraction.
- There is no visible unified command surface for verification beyond lint/build/release scripts.
