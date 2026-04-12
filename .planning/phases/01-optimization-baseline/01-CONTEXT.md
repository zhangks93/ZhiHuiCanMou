# Phase 1: Optimization Baseline - Context

**Gathered:** 2026-04-12  
**Status:** Ready for planning  
**Source:** Brownfield initialization + user request

<domain>
## Phase Boundary

This phase does not implement the major refactors themselves. It establishes the engineering diagnosis required to execute those refactors safely in later phases. The phase must analyze the current Tauri 2 + React + Rust + Supabase + Agent runtime codebase from a senior agent-engineering and Rust-engineering perspective, with specific attention to:

- performance bottlenecks,
- code structure and module boundaries,
- writing style and maintainability,
- runtime stability and failure modes,
- test and verification gaps,
- repo hygiene and operational friction.

</domain>

<decisions>
## Implementation Decisions

### Locked decisions

- Phase 1 is analysis-first and planning-first, not a large code refactor.
- The analysis must be grounded in the existing brownfield codebase, not generic framework advice.
- Authentication, Agent runtime, and verification infrastructure are first-tier focus areas.
- Recommendations must be prioritized so later phases can execute them in dependency order.
- The output must be actionable enough to drive Phase 2 through Phase 5.

### the agent's Discretion

- Exact format of the baseline diagnosis documents
- How to group findings into performance, architecture, stability, and verification sections
- Which secondary hotspots to include beyond the mandatory focus areas

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning source of truth
- `.planning/PROJECT.md` — overall project intent, constraints, and active milestone focus
- `.planning/REQUIREMENTS.md` — optimization requirements for this milestone
- `.planning/ROADMAP.md` — phase goals and success criteria
- `.planning/STATE.md` — current planning state

### Brownfield codebase map
- `.planning/codebase/STACK.md` — runtime and dependency inventory
- `.planning/codebase/ARCHITECTURE.md` — architecture and data flow baseline
- `.planning/codebase/CONCERNS.md` — current high-risk areas and optimization signals
- `.planning/codebase/TESTING.md` — current verification posture and gaps

### High-signal implementation files
- `app/src/shared/lib/agent/chatAgent.ts` — central Agent runtime
- `app/src/features/auth/pages/AuthCallbackPage.tsx` — auth callback UX and orchestration
- `app/src/features/auth/services/authSessionService.ts` — session recovery and refresh behavior
- `app/src/features/auth/services/tauriOAuthService.ts` — desktop OAuth bridge
- `app/src-tauri/src/lib.rs` — Tauri deep-link runtime logic
- `supabase/functions/feishu-callback/index.ts` — OAuth callback exchange and user sync
- `supabase/functions/feishu-refresh/index.ts` — refresh endpoint
- `app/src/features/biz-data/services/bizDataService.ts` — representative data-heavy transformation path

</canonical_refs>

<specifics>
## Specific Ideas

- The user explicitly asked for optimization analysis from the perspective of a senior agent engineer and Rust engineer.
- The result should surface where to optimize next, not just list generic code smells.
- The output should create a shared baseline for future execution phases.

</specifics>

<deferred>
## Deferred Ideas

- Actual runtime decomposition of `chatAgent.ts`
- Auth hardening implementation
- Performance instrumentation or caching changes
- Automated test framework adoption and CI wiring

</deferred>

---

*Phase: 01-optimization-baseline*  
*Context gathered: 2026-04-12 via brownfield initialization*
