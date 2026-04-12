# Codebase Map: Architecture

## Top-Level Shape

- `app/` contains the product UI, app shell, auth flow, business features, and agent runtime.
- `app/src-tauri/` is a thin host layer focused on deep-link and plugin setup rather than heavy native domain logic.
- `supabase/` acts as the backend control plane through schema migrations and two Feishu-related edge functions.
- `scripts/` contains operational ingestion/reporting utilities that support the product data layer.

## Frontend Layering

- App shell and composition live under `app/src/app/`.
- Domain slices live under `app/src/features/`.
- Reusable primitives, shared libs, storage, and UI components live under `app/src/shared/`.
- This is a conventional feature-sliced frontend with a moderate separation between app wiring, domain code, and shared infrastructure.

## Runtime Entry Points

- Browser entry: `app/src/main.tsx`
- Root app component: `app/src/App.tsx`
- Route graph: `app/src/app/router/routes.tsx`
- Native bootstrap: `app/src-tauri/src/main.rs` and `app/src-tauri/src/lib.rs`
- Edge runtimes: `supabase/functions/feishu-callback/index.ts` and `supabase/functions/feishu-refresh/index.ts`

## Main User Flows

### Authentication

1. User starts in `app/src/features/auth/pages/LoginPage.tsx`.
2. OAuth redirects into `supabase/functions/feishu-callback/index.ts`.
3. Supabase Auth magic link/session is produced there.
4. Callback route `app/src/features/auth/pages/AuthCallbackPage.tsx` parses tokens and validates state.
5. Desktop path uses Tauri events in `app/src/features/auth/services/tauriOAuthService.ts`.
6. Session is applied and refreshed via `app/src/features/auth/services/authSessionService.ts`.
7. `app/src/app/providers/AuthProvider.tsx` publishes auth state to the app.

### Business Data Pages

1. Route selection happens in `app/src/app/router/routes.tsx`.
2. Feature page components under `app/src/features/*/pages` orchestrate page state.
3. Feature repositories and hooks fetch/transform data from Supabase.
4. Shared UI shells like `app/src/shared/ui/TabbedPageShell.tsx` and `app/src/shared/ui/StatCard.tsx` render standardized layouts.

### Agent Chat

1. UI lives under `app/src/features/agent-chat/components/` and `app/src/features/agent-chat/pages/`.
2. Agent definitions are assembled from skill configs and prompts in `app/src/shared/lib/agent/skills/`.
3. `app/src/shared/lib/agent/chatAgent.ts` handles streaming, tool calls, cache/reuse protection, and provider-specific request formatting.
4. Conversation and artifact persistence use browser storage through `app/src/shared/lib/agent/conversationStore.ts`, `app/src/shared/lib/agent/artifactStore.ts`, and `app/src/shared/storage/createBrowserStore.ts`.

## Architectural Patterns

- UI follows a route + page + hook + repository pattern for most product features.
- Shared utility code is mostly functional rather than class-heavy.
- The agent subsystem is the most stateful area and uses a central `ChatAgent` class.
- Rust is acting as an integration adapter instead of a business-logic layer.

## Cross-Layer Data Flow

- Env values from `app/src/app/config/env.ts` feed Supabase, Feishu, and auth behavior.
- Repositories query Supabase directly and return domain-shaped data to hooks/pages.
- Auth state is pushed down through a React context provider.
- Agent UI sends messages into `ChatAgent`, which may call local tools, consume local references, and then stream text/thinking/tool events back to the UI.

## Notable Architectural Boundaries

- Feature boundaries are present but not fully uniform; some features use `api/`, some `services/`, some only `pages/`.
- The agent subsystem has its own mini-platform inside `app/src/shared/lib/agent/`, including registry, tools, prompts, memory, and artifact storage.
- Operational scripts and Supabase migrations sit outside the frontend app and are not strongly integrated through a single developer workflow.

## Architectural Risks

- A large amount of product value sits in the frontend process, increasing coupling to WebView/browser lifecycle constraints.
- Auth spans many layers and runtimes, making it one of the most failure-prone paths.
- The repo currently mixes product code, deployment assets, generated Android output, import tooling, and marketing site content in one workspace, which raises navigation and maintenance costs.
