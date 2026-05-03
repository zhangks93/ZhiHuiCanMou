# Project — UI Review

**Audited:** 2026-05-03
**Scope:** Entire frontend under `app/src`
**Baseline:** Abstract 6-pillar UI standards plus existing project tokens
**Screenshots:** Attempted against `http://localhost:5173`; capture failed because Playwright browser binaries are not installed.
**Static checks:** `npm run test` passed; `npm run lint` failed with 1 error and 3 warnings.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Most product copy is domain-specific Chinese copy, but several empty and debug states remain generic or operational. |
| 2. Visuals | 2/4 | The app has a coherent glass-panel direction, but visual primitives are duplicated across global CSS, Tailwind classes, daisyUI classes, and inline styles. |
| 3. Color | 2/4 | Token colors exist, but hardcoded `rgba`, hex values, Tailwind gray/slate/emerald/red classes, and chart colors bypass the system. |
| 4. Typography | 3/4 | Typography is intentionally constrained, but component code still uses non-token weights and ad hoc tiny sizes. |
| 5. Spacing | 2/4 | Layout uses many arbitrary radii, shadows, widths, fixed heights, and padding values, which weakens consistency and scalability. |
| 6. Experience Design | 3/4 | Loading/error/empty states are broadly present, but destructive actions and some controls lack consistent confirmation and accessibility patterns. |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **Consolidate the design system source of truth** — UI drift is already visible because `theme.ts`, `tokens.css`, `index.css`, daisyUI, and feature files all define colors/radii/shadows. Move primitive values into tokens and expose reusable component classes or React primitives for panels, buttons, badges, tables, empty states, and filters.
2. **Reduce feature-specific styling in `index.css`** — `app/src/index.css` is thousands of lines and mixes global shell styles, business table layout, chat UI, modal styles, and feature-specific selectors. Split it by ownership or replace repeated blocks with shared components so new modules do not keep copying arbitrary visual values.
3. **Fix static quality gates before visual polish** — `npm run lint` fails on `app/src/features/trip/pages/TripPage.tsx:495` and warns in `StrategyPlanView.tsx`, `TableView.tsx`, and `OpportunityPage.tsx`. Keep lint green before adding more UI behavior.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Strengths:
- Shared data states exist: `DataLoadingState`, `DataErrorState`, and `DataEmptyState` are used by Attendance, Biz Data, Opportunity, Trip, and Schedule Inbox.
- Empty state copy is usually contextual, for example `AttendancePage.tsx:273`, `OpportunityPage.tsx:222`, `TripPage.tsx:775`, and `BizDataPage.tsx:145`.
- Action labels are mostly Chinese and task-oriented, such as `保存`, `发送`, `导入`, `清空`, `重试登录`.

Gaps:
- `WorkspacePage.tsx:46` says `当前没有可用的工作台模块`, which explains state but does not give recovery guidance.
- `OrgDataPage.tsx:247` exposes an implementation command directly in the UI: `python scripts/sync_feishu_contacts.py`. That is useful for developers but not appropriate for a polished business app surface.
- `DeepLinkTestPage.tsx` contains developer-test UI and inline debug copy. If this route ships, it should be gated or styled as an internal diagnostics tool.

Recommendation:
- Define a copy contract for empty states: `what happened`, `why it matters`, `next action`. Make this the default API for `DataEmptyState`.

### Pillar 2: Visuals (2/4)

Strengths:
- The shell has a recognizable product direction: soft background, translucent panels, compact navigation, and dense data surfaces.
- Layout components use lucide icons and generally include labels or titles for compact icon controls.

Gaps:
- `MainLayout.tsx:21`, `Sidebar.tsx:37`, `BottomNav.tsx:10`, and many feature pages hardcode layout dimensions, radii, shadows, and active states instead of using the token layer.
- `index.css` contains global shell styles plus business table, chat, agent directory, modal, and responsive feature styling. This makes visual ownership hard to reason about and increases regression risk.
- Some pages mix the primary style with daisyUI button/input classes, for example `SchedulePage.tsx:305`, `SchedulePage.tsx:355`, and `AgentChatPage.tsx:528`, which can produce inconsistent control density and interaction states.
- `Header.tsx` exists but is not used by `MainLayout.tsx`; the app currently relies on sidebar/bottom nav plus page content. If header patterns remain unused, remove or re-integrate them to avoid parallel navigation concepts.

Recommendation:
- Build a small UI kit around the existing direction: `AppButton`, `AppIconButton`, `AppPanel`, `AppTableShell`, `AppModal`, `AppBadge`, `AppFilterControl`, `AppMetricCard`. Then migrate feature pages away from raw class strings.

### Pillar 3: Color (2/4)

Strengths:
- `theme.ts` and `tokens.css` define a restrained palette with primary, accent, success, warning, error, text, border, and surface values.
- Business status colors are mostly semantically meaningful.

Gaps:
- `tokens.css` says values should stay aligned with `theme.ts`, but they are maintained manually. That creates drift risk.
- `index.css` contains many hardcoded `rgba(...)`, hex values, and gradients even where matching token values exist.
- Components bypass tokens in several places: `StatCard.tsx:13`, `OpportunityPage.tsx:22-26`, `StrategyPlanView.tsx:364-365`, `DeepLinkTestPage.tsx`, and `ChatMarkdown.tsx:82`.
- Feature pages mix `text-gray-*`, `bg-slate-*`, `emerald-*`, `rose-*`, `red-*`, and custom CSS variables. Examples include `OrgDataPage.tsx:112-136`, `SettingsPage.tsx:200-424`, and `SchedulePage.tsx:279-754`.

Recommendation:
- Add semantic aliases such as `--color-status-new`, `--color-status-won`, `--color-chart-revenue`, `--color-chart-profit`, `--color-control-hover`, and `--color-selected-bg`. Prefer CSS variables or Tailwind theme keys over arbitrary color literals.

### Pillar 4: Typography (3/4)

Strengths:
- `theme.ts` intentionally maps most display sizes into a compact scale, which fits the operational dashboard domain.
- The app generally uses `text-caption`, `text-body`, `text-subtitle`, and `text-title`, avoiding oversized marketing typography.

Gaps:
- Tailwind weight aliases are remapped to medium in `tailwind.config.js`, but component code still uses `font-semibold`, `font-bold`, and `font-normal`. This makes intent unclear even if generated weight values collapse.
- `SchedulePage.tsx:661` and `SchedulePage.tsx:663` use `text-[11px]` and `text-[10px]`, introducing sizes outside the token scale.
- `ChatMarkdown.tsx` includes raw HTML preview CSS with its own font and color definitions.

Recommendation:
- Limit code review-approved font classes to `font-normal`, `font-medium`, `text-caption`, `text-body`, `text-subtitle`, and `text-title`, with exceptions documented for dense calendar badges or generated markdown previews.

### Pillar 5: Spacing (2/4)

Strengths:
- Many repeated components use compact, data-friendly spacing.
- Tables and filter bars include responsive behavior for horizontal overflow.

Gaps:
- Arbitrary dimensions are widespread: `Sidebar.tsx:37-39`, `MainLayout.tsx:21`, `Header.tsx:46`, `BottomNav.tsx:10`, `BizDataPage.tsx:83`, `MetricSelector.tsx:57`, and `OrgDataPage.tsx:280`.
- Cards commonly use `rounded-[20px]`, `rounded-[22px]`, `rounded-[26px]`, `rounded-[28px]`, plus token radii. The visual difference is small but the maintenance cost is high.
- Several tables calculate row/column dimensions with inline styles, which is acceptable for synchronized virtual/table layout, but should be isolated in table primitives rather than repeated in Attendance, Trip, Biz Data, and Strategy Plan components.

Recommendation:
- Create named layout tokens for shell offsets, card radius, modal radius, sidebar width, dense table row height, and chart heights. Ban new arbitrary spacing unless it is attached to measured table geometry.

### Pillar 6: Experience Design (3/4)

Strengths:
- App-level error protection exists in `main.tsx:21` and `ErrorBoundary.tsx`.
- Protected/public route loading states exist in `ProtectedRoute.tsx` and `PublicRoute.tsx`.
- Many data pages cover loading, error, and empty states, especially Attendance, Trip, Biz Data, Opportunity, and Schedule Inbox.
- Icon-only buttons usually have `aria-label` or `title`, for example `Sidebar.tsx:90-91`, `Header.tsx:95`, `AgentChatPage.tsx:428-442`, and `StrategyPlanView.tsx:221`.

Gaps:
- Destructive actions such as deleting conversations and deleting schedule items appear as direct icon actions (`ConversationList.tsx:81-82`, `SchedulePage.tsx:754`) without a consistent confirmation pattern.
- Search in `Header.tsx:81` is rendered as static text rather than an input or command trigger; if retained, it should be functional or removed.
- Mobile navigation is hardcoded to `grid-cols-4` in `BottomNav.tsx:11`; if enabled modules exceed four, items may compress or overflow.
- Lint reports a performance-related React hook error in `TripPage.tsx:495`, and React compiler warnings around TanStack Table usage in `TableView.tsx:195` and `OpportunityPage.tsx:163`.

Recommendation:
- Add shared `ConfirmAction`, `CommandSearch`, and `ResponsiveNav` primitives. Make destructive actions require confirmation by default unless explicitly marked low-risk.

---

## Maintainability And Scalability

Primary concern:
- The current visual system is implemented more as accumulated class strings than as stable abstractions. The app is still coherent, but adding another major module will likely increase drift.

Recommended sequence:
1. Generate `tokens.css` from `theme.ts`, or move to CSS variables as the source and import them into Tailwind. Avoid manually syncing both.
2. Split `index.css` into `base.css`, `layout.css`, `components.css`, and feature-owned CSS modules/files, or migrate repeated rules into React components.
3. Replace daisyUI button/input usage in product pages with app-owned primitives to avoid parallel design languages.
4. Introduce lint rules or project conventions for arbitrary Tailwind values, inline styles, and raw color literals.
5. Add visual smoke tests for shell, data table, chat, auth, and schedule flows once Playwright browsers are installed.

---

## Static Code Quality

Checks run:
- `npm run test` passed: 3 files, 8 tests.
- `npm run lint` failed.

Lint findings:
- `app/src/features/trip/pages/TripPage.tsx:495` — `react-hooks/set-state-in-effect` error from synchronous `setExpandedTreeKeys` inside an effect.
- `app/src/features/biz-data/components/StrategyPlanView.tsx:273` — unnecessary `useMemo` dependency `pivotMetric`.
- `app/src/features/biz-data/components/TableView.tsx:195` — React compiler skips memoization around TanStack `useReactTable`.
- `app/src/features/opportunity/pages/OpportunityPage.tsx:163` — same TanStack `useReactTable` warning.

Other code quality risks:
- `DeepLinkTestPage.tsx` is almost entirely inline-styled; gate it as dev-only or refactor it into the design system.
- `ChatMarkdown.tsx` injects large HTML/CSS strings for preview rendering. Keep this isolated and add focused tests because it is security- and rendering-sensitive.
- `MetricSelector.tsx:45` and `MetricSelector.tsx:57` use `zIndex: 9999`; introduce a z-index token scale.

---

## Registry Safety

No `components.json` was found at the repository root or under `app/`, so shadcn/third-party registry audit was not applicable.

---

## Files Audited

Representative files examined:
- `app/package.json`
- `app/tailwind.config.js`
- `app/src/theme.ts`
- `app/src/index.css`
- `app/src/shared/styles/tokens.css`
- `app/src/App.tsx`
- `app/src/main.tsx`
- `app/src/app/layout/MainLayout.tsx`
- `app/src/app/layout/Sidebar.tsx`
- `app/src/app/layout/Header.tsx`
- `app/src/app/layout/BottomNav.tsx`
- `app/src/shared/ui/*`
- `app/src/shared/components/data-state/*`
- `app/src/features/biz-data/**`
- `app/src/features/agent-chat/**`
- `app/src/features/schedule/**`
- `app/src/features/org/**`
- `app/src/features/opportunity/**`
- `app/src/features/trip/**`
- `app/src/features/attendance/**`
- `app/src/features/auth/**`
- `app/src/features/settings/**`
- `app/src/features/links/**`
- `app/src/features/workspace/**`
