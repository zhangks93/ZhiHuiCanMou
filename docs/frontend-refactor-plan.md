# Frontend Refactor Plan

## Goal

Move the frontend from page-centric growth to a feature-first structure with clear boundaries between:

- app composition
- feature domain logic
- shared UI and infrastructure

This refactor is incremental. Each phase must:

1. keep the app buildable
2. preserve existing behavior
3. reduce direct page coupling to storage, Supabase, and browser globals

## Target Structure

```text
app/src
  app/
    providers/
    router/
    layout/
  features/
    auth/
    biz-data/
    agent-chat/
    settings/
    dashboard/
    opportunity/
    work-report/
    org/
    attendance/
  shared/
    ui/
    lib/
    storage/
    styles/
    types/
    config/
```

## Architectural Rules

- `app/` only wires providers, routing, and shell layout.
- `features/` own domain-specific pages, hooks, services, storage, and components.
- `shared/` contains cross-feature utilities only.
- Pages should not call `supabase.from(...)` directly.
- Pages should not access `localStorage` directly.
- Feature internals should be accessed through each feature's public modules, not deep imports from unrelated features.

## Planned Phases

### Phase 0

- Add target directory skeleton.
- Add this document as the execution baseline.

### Phase 1

- Unify browser storage patterns.
- Replace ad hoc custom window events with explicit store subscriptions.

### Phase 2

- Split auth lifecycle responsibilities from React context.

### Phase 3

- Convert biz-data into the first fully feature-scoped domain.

### Phase 4

- Split AI chat page state, streaming logic, and persistence.

### Phase 5

- Standardize remaining major pages to page -> hook -> repository.

### Phase 6

- Centralize route and shell composition in `app/`.

### Phase 7

- Split theme and CSS responsibilities into shared and feature styles.

## Execution Notes

- Prefer extracting logic before moving files.
- Keep each phase separately buildable.
- Run `npm run build` after each phase.
- Create one commit per completed phase.
