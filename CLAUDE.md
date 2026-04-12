<!-- GSD:project-start source:PROJECT.md -->
## Project

**智汇参谋 (Canmou)**

智汇参谋是一个基于 Tauri 2、React 19、TypeScript、Supabase 与 Rust 的企业智能助手应用，当前已经覆盖日程、经营数据、商机、组织、考勤、出差与 Agent 对话等核心能力。现阶段的工作重点不是扩展业务面，而是把现有 Agent 与桌面运行时能力做实，系统性提升性能、结构清晰度、稳定性与可验证性。

**Core Value:** 让用户稳定、快速、可信地通过桌面端智能助手访问关键业务能力与数据，而不是被认证、性能或 Agent 不确定性拖垮体验。

### Constraints

- **Tech stack**: 以 Tauri 2 + React 19 + TypeScript + Supabase + Rust 为主 — 现有产品已经建立在该栈上，优化应优先兼容现状
- **Brownfield reality**: 需要在已有功能持续可用的前提下优化 — 不能用“推倒重来”换取表面整洁
- **Cross-runtime complexity**: 代码同时运行于浏览器、Tauri WebView、Rust host、Supabase Edge Runtime 与 Python 工具链 — 任何优化都要考虑跨运行时边界
- **Stability first**: 认证链路、Agent 交互和核心数据页面不能因重构产生明显回归 — 这是现有可用性的底线
- **Verification gap**: 当前自动化测试薄弱 — 计划必须优先补齐可验证性，否则后续优化风险过高
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Snapshot
- Project type: brownfield desktop-first business assistant built with Tauri 2, React 19, TypeScript, Supabase, and supplemental Python/Node tooling.
- Primary app root: `app/`
- Native shell: `app/src-tauri/`
- Backend/data surface: `supabase/`
- Utility/import scripts: `scripts/`
- Marketing site: `docs/`
## Languages And Runtimes
- TypeScript/TSX powers the main UI and most business logic under `app/src/`.
- Rust powers the Tauri host in `app/src-tauri/src/lib.rs` and `app/src-tauri/src/main.rs`.
- Deno TypeScript is used for Supabase Edge Functions in `supabase/functions/feishu-callback/index.ts` and `supabase/functions/feishu-refresh/index.ts`.
- Python is used for data import and chart generation in files such as `scripts/import_biz_data.py`, `scripts/import_attendance.py`, and `scripts/render_chart_specs.py`.
- Node.js is used for frontend build/dev orchestration and helper scripts such as `scripts/run-tauri.mjs`.
## Frontend Framework Stack
- React 19 with lazy-loaded route modules in `app/src/app/router/routes.tsx`.
- React Router 7 for route protection and nested layouts in `app/src/app/router/routes.tsx`, `app/src/app/router/ProtectedRoute.tsx`, and `app/src/app/router/PublicRoute.tsx`.
- Vite 7 for dev/build via `app/package.json` and `app/vite.config.ts`.
- TypeScript 5.9 project references via `app/tsconfig.json`, `app/tsconfig.app.json`, and `app/tsconfig.node.json`.
- Tailwind CSS 3 plus DaisyUI 4 for styling via `app/tailwind.config.js`, `app/postcss.config.js`, `app/src/index.css`, and `app/src/shared/styles/tokens.css`.
- `lucide-react`, `react-markdown`, `remark-gfm`, `recharts`, `@tanstack/react-table`, `@hello-pangea/dnd`, and `@dnd-kit/*` support UI behavior and visualization.
## Native/Desktop-Mobile Shell
- Tauri 2 configured in `app/src-tauri/tauri.conf.json`.
- Enabled plugins in Rust: shell, opener, http, and deep-link from `app/src-tauri/src/lib.rs`.
- Android project is generated under `app/src-tauri/gen/android/`.
- The app is configured for desktop and Android packaging; `app/src-tauri/tauri.conf.json` shows `android.minSdkVersion = 24`.
## Backend And Data Stack
- Supabase JS client is initialized in `app/src/shared/lib/supabase.ts`.
- Generated DB types live in `app/src/shared/lib/database.types.ts`.
- SQL migrations are tracked in `supabase/migrations/`.
- Feishu OAuth and session refresh are implemented with Supabase Edge Functions under `supabase/functions/`.
## Agent/LLM Stack
- Model config is abstracted via `app/src/shared/lib/llmConfig.ts`.
- Core agent runtime lives in `app/src/shared/lib/agent/chatAgent.ts`.
- Tool definitions and dispatch live in `app/src/shared/lib/agent/tools/`.
- Skill packaging uses `skill.json`, `prompt.md`, references, and assets under `app/src/shared/lib/agent/skills/financial-analysis/`.
- Runtime supports both OpenAI-compatible APIs and Claude-style APIs in `app/src/shared/lib/agent/chatAgent.ts`.
## Build And Release Tooling
- Frontend scripts live in `app/package.json`.
- Repo-level scripts include Tauri wrapper logic in `scripts/run-tauri.mjs`.
- GitHub Actions build release artifacts in `.github/workflows/build-release.yml`.
- GitHub Pages deployment for the marketing site is handled in `.github/workflows/pages.yml` and `.github/workflows/deploy-pages.yml`.
## Environment And Configuration
- Runtime env parsing is centralized in `app/src/app/config/env.ts`.
- Current env categories: Supabase, Feishu OAuth, auth tuning flags, and external links.
- Tauri build expects frontend output at `app/dist` and dev server at `http://localhost:5173` from `app/src-tauri/tauri.conf.json`.
## Current Stack Observations
- The stack is pragmatic and modern, but it spans five execution environments: browser, Tauri WebView, Rust host, Deno edge runtime, and Python import scripts.
- The narrow Rust layer suggests most product behavior currently lives in TypeScript rather than native commands.
- There is no visible package dedicated to testing in `app/package.json`; lint/build are present, but test scripts are not.
- Generated Android files are committed under `app/src-tauri/gen/android/`, which increases repo surface area and maintenance burden.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

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
- Agent skill packaging convention is:
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
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

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
### Business Data Pages
### Agent Chat
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
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
