# Optimization Baseline Report

## Executive Summary

Phase 1 confirms that this repository is no longer a “small app with some technical debt.” It is already a cross-runtime system with a meaningful Agent platform inside it. That changes the optimization strategy. The most important next step is not scattered cleanup. It is creating a clear execution order for the few structural issues that dominate both performance and stability risk.

Two P0 findings stand above the rest:

1. **Centralized Agent runtime complexity in `app/src/shared/lib/agent/chatAgent.ts`**
2. **Distributed auth chain lacks a single, testable source of truth**

Those two areas directly affect later work on performance, reliability, and verification. A third issue is close behind:

3. **Frontend-side hierarchical aggregation in `app/src/features/biz-data/services/bizDataService.ts`**

That is the main concrete application-side performance hotspot surfaced by the code review.

The final conclusion is that the project should not treat verification as a follow-up luxury. Missing tests around auth, runtime orchestration, and data transforms are part of the optimization problem itself. If the codebase is restructured without stronger verification, the chance of regressions is too high.

## Priority Matrix

### P0

| Priority | Finding | Why it is P0 | Immediate implication |
|---|---|---|---|
| P0 | Centralized Agent runtime complexity in `app/src/shared/lib/agent/chatAgent.ts` | This file currently concentrates provider transport, stream parsing, tool orchestration, cache logic, and payload shaping into one operational class | Phase 2 must break this apart before deep performance or feature evolution work continues |
| P0 | Distributed auth chain lacks a single, testable source of truth | Feishu callback exchange, Supabase admin flows, browser parsing, Tauri deep-link handling, and session restoration are distributed across too many boundaries | Phase 4 hardening needs an explicit state model and failure contract, not isolated bug fixes |
| P0 | Verification coverage is missing exactly where the architecture is most fragile | The riskiest paths in auth and agent runtime do not have visible automated regression coverage | Phase 5 must be treated as enabling infrastructure, not background cleanup |

### P1

| Priority | Finding | Why it is P1 | Immediate implication |
|---|---|---|---|
| P1 | Frontend-side hierarchical aggregation in `app/src/features/biz-data/services/bizDataService.ts` | Large reporting datasets are fetched and aggregated in the frontend process | Phase 3 should quantify and reduce this work through measurement, caching, or boundary changes |
| P1 | Multiple lossy context-compression layers across the Agent path | Truncation, artifact externalization, rolling summaries, and prompt caps are all active | Phase 3 should decide which layers are strategic and which are compensating for architecture debt |
| P1 | Missing runtime-level instrumentation around HTTP and tool execution | There is no standard measurement path for request latency, payload growth, or tool cost | Phase 3 must add observability before optimization claims become credible |
| P1 | Desktop OAuth completion uses timing and event assumptions | Desktop completion depends on event timing plus delayed window close | Phase 4 should replace this with a positive handshake and clearer completion boundary |
| P1 | Tauri deep-link handling is resilient but not easily verifiable | Rust retry behavior exists, but it is not modeled in narrow, testable phases | Phase 4 should harden and simplify this path while improving failure reporting |

### P2

| Priority | Finding | Why it is P2 | Immediate implication |
|---|---|---|---|
| P2 | Browser-storage artifact pressure remains a soft ceiling | Conversation artifacts and summaries are better managed, but still browser-storage bound | Keep visible during Phase 3 once runtime instrumentation exists |
| P2 | Auth observability is still mostly console-driven | Debug output exists but is not normalized into durable telemetry | Improve after core auth flow boundaries are clarified |
| P2 | Repo-boundary noise slows engineering navigation | Generated Android output, spreadsheets, report assets, and scripts raise workspace complexity | Address opportunistically once higher-risk runtime work is underway |

## Cross-Cutting Themes

### Theme 1: Concentration is the root cause

In both the Agent runtime and the auth flow, the main issue is not one “bad line of code.” It is concentration:

- too many responsibilities in one runtime class;
- too many state transitions across too many files;
- too much implicit coordination via logs, conventions, and timing assumptions.

This means structural clarity is a prerequisite for both performance and stability.

### Theme 2: Performance and maintainability are linked

`chatAgent.ts` and `bizDataService.ts` show that runtime cost and code-shape cost are linked. The codebase cannot sustainably optimize one without addressing the other:

- a hard-to-split runtime is hard to instrument;
- a hard-to-measure path is hard to optimize with confidence;
- a hard-to-test path is hard to refactor safely.

### Theme 3: Verification debt is architectural debt

The current lack of targeted tests is not just a quality-process issue. It is a blocker for safe system evolution. In this repository, verification debt attaches directly to:

- auth transition logic;
- provider/tool orchestration;
- hierarchy aggregation and data shaping;
- desktop runtime recovery behavior.

## Phase Mapping

### Phase 2: Runtime Architecture Cleanup

Phase 2 should absorb the architecture-heavy baseline findings:

- centralized `chatAgent.ts` runtime responsibilities;
- unclear boundary between transport, tool execution, compaction, and memory shaping;
- coupling between runtime control flow and future observability needs.

**Recommended Phase 2 target:** establish a narrower runtime module graph so the Agent path can be reasoned about, tested, and instrumented separately.

### Phase 3: Performance Pass

Phase 3 should absorb the measurable-cost findings:

- frontend-heavy aggregation in `bizDataService.ts`;
- layered context compression tradeoffs;
- missing runtime-level instrumentation;
- browser-storage artifact pressure.

**Recommended Phase 3 target:** add measurement first, then reduce the highest-cost paths with evidence rather than guesswork.

### Phase 4: Auth And Stability Hardening

Phase 4 should absorb the distributed-state findings:

- auth callback parsing ambiguity;
- split client/server state authority;
- desktop event-bridge and timeout assumptions;
- Rust deep-link retry opacity;
- duplicated or partially explicit refresh semantics.

**Recommended Phase 4 target:** define the auth/deep-link/session lifecycle explicitly, then harden each transition against known failure modes.

### Phase 5: Verification Net

Phase 5 should absorb the safety-net findings:

- missing auth parser and session tests;
- missing Agent runtime compaction and loop-protection tests;
- missing business-data transform regression tests;
- missing cross-runtime regression entry points.

**Recommended Phase 5 target:** create the minimum automated verification floor that later engineering changes can rely on locally and in CI.

## Verification Debt

The current minimum debt inventory is:

- callback URL parser tests
- state-validation tests
- session recovery tests
- session refresh scheduling tests
- desktop `auth:oauth-complete` bridge tests
- deep-link parsing and retry tests
- `chatAgent` compaction and repeated-tool protection tests
- provider-branch tests for OpenAI-compatible vs Claude execution
- `aggregateByNode` and `buildTreeWithAggregation` regression tests

This is enough to define a focused Phase 5 without inventing new scope.

## Recommended Execution Order

1. **Start with Phase 2** to decompose the runtime boundary around `chatAgent.ts`.
2. **Then Phase 3** to instrument and optimize the highest-cost runtime and data paths.
3. **Run Phase 4** to harden the distributed auth/deep-link/session chain with a clearer state model.
4. **Run Phase 5** to lock in the new architecture with automated verification coverage, or pull selected Phase 5 checks forward if runtime/auth refactors begin to feel unsafe sooner.

## Final Position

The codebase is already good enough to support a serious optimization milestone, but only if later work stays disciplined about order:

- structure before micro-tuning,
- state-model clarity before auth patching,
- measurement before performance claims,
- verification before aggressive refactoring.

That is the actionable baseline Phase 1 was supposed to produce.
