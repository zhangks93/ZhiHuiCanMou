# Codebase Map: Stack

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
