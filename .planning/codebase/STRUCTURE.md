# Codebase Map: Structure

## Repository Layout

- `app/` — main Tauri + React application
- `app/src/` — frontend source
- `app/src-tauri/` — Rust host, Tauri config, icons, Android generation
- `supabase/` — migrations and edge functions
- `scripts/` — import, chart, and dev helper scripts
- `docs/` — marketing/static site and sample data assets
- `.github/workflows/` — release and Pages automation

## Frontend Structure

### App Wiring

- `app/src/app/config/` — constants, env, module metadata, theme config
- `app/src/app/layout/` — shell components like header, sidebar, bottom nav
- `app/src/app/providers/` — auth context and error boundary
- `app/src/app/router/` — protected/public route handling and route table

### Feature Slices

- `app/src/features/agent-chat/` — agent directory, chat UI, hooks, conversation views
- `app/src/features/auth/` — login, callback pages, OAuth/session services
- `app/src/features/biz-data/` — business metrics page, chart/table components, aggregation services
- `app/src/features/org/`, `opportunity/`, `schedule/`, `attendance/`, `trip/`, `links/`, `workspace/`, `settings/` — additional business modules
- `app/src/features/dashboard/` exists as a directory shell but appears empty/incomplete in the current snapshot.

### Shared Area

- `app/src/shared/lib/` — cross-cutting utilities
- `app/src/shared/lib/agent/` — agent runtime, types, memory, tools, skill loader
- `app/src/shared/storage/` — browser storage abstractions
- `app/src/shared/styles/` — design tokens
- `app/src/shared/ui/` — reusable UI components

## Native Structure

- `app/src-tauri/src/lib.rs` — app builder and deep-link logic
- `app/src-tauri/src/main.rs` — main entrypoint
- `app/src-tauri/capabilities/` — Tauri capability JSON
- `app/src-tauri/gen/android/` — generated Android project files
- `app/src-tauri/icons/` — platform icon assets

## Backend/Data Structure

- `supabase/migrations/` — schema history
- `supabase/functions/feishu-callback/` — OAuth callback exchange and user sync
- `supabase/functions/feishu-refresh/` — refresh endpoint
- `supabase/database_schema.md` and `supabase/edge_functions.md` — handwritten backend reference docs

## Script Structure

- Importers: `scripts/import_*.py`
- Feishu sync helper: `scripts/sync_feishu_contacts.py`
- Chart rendering: `scripts/render_chart_specs.py`
- Browser automation snapshot: `scripts/browser-snapshot.js`
- Tauri command wrapper: `scripts/run-tauri.mjs`

## Naming And Organization Patterns

- Feature directories generally follow `api/`, `hooks/`, `pages/`, and sometimes `components/` or `services/`.
- Shared library files use mostly flat descriptive names such as `auth-cache.ts`, `auth-errors.ts`, and `moduleStorage.ts`.
- Agent tooling uses noun-oriented filenames like `conversationStore.ts`, `artifactStore.ts`, and `toolRegistry.ts`.

## Structural Observations

- The repo is cohesive enough to navigate, but it is carrying several concerns in one place: app code, edge functions, migrations, generated mobile artifacts, data spreadsheets, and import utilities.
- `docs/data/` contains operational spreadsheet assets that are large and domain-specific; they are not just documentation.
- The current structure supports incremental feature work, but long-term maintainability would improve from stricter boundaries between product code, generated output, and data operations.
