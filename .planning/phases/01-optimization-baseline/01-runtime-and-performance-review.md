# Runtime And Performance Review

## Executive Summary

This codebase already contains explicit performance-defense work, especially in `app/src/shared/lib/agent/chatAgent.ts`, where context truncation, tool-result compaction, repeated-call detection, and maximum tool-call depth protections have been added. That is a useful sign: the team is already encountering real pressure from context size, streaming complexity, and model/tool feedback loops.

The problem is that the same file now acts as transport adapter, stream parser, tool orchestrator, cache manager, truncation layer, and loop-protection layer at once. The optimization opportunity is therefore not only raw performance. It is also decomposition, because the current concentration of responsibilities makes future performance work slower and riskier than it should be.

The second runtime pressure point is the data-heavy business reporting path in `app/src/features/biz-data/services/bizDataService.ts`. That file performs repeated pagination loops over Supabase tables, materializes entire datasets into memory, and then does multiple rounds of synthetic aggregation and tree construction in the frontend process. This is workable at modest scale, but it is expensive in a Tauri WebView app where the same process also hosts UI rendering and Agent interaction.

Finally, `app/src/shared/lib/httpClient.ts` is intentionally small, but it currently hides runtime divergence behind a thin abstraction. That helps portability, yet it also means performance and failure differences between browser fetch and Tauri HTTP are not observable or instrumented. For an optimization milestone, that is a visibility gap.

## Observed Hotspots

### 1. `app/src/shared/lib/agent/chatAgent.ts` is the dominant runtime hotspot

The file currently combines:

- OpenAI-compatible request construction and SSE stream parsing
- Claude request construction and stream parsing
- tool-call accumulation and replay
- loop-depth protection via `MAX_TOOL_CALL_DEPTH`
- per-call and per-core-call cache/reuse accounting
- result truncation and compaction rules for file reads, hierarchical data, and query previews
- finalization logic when repeated tool calls exceed the reuse threshold

This means every optimization or reliability change in the Agent path tends to land in the same class. That is expensive in three ways:

1. reasoning about behavior becomes slower, because performance logic and provider logic are intertwined;
2. regression surface expands, because one edit can affect multiple streaming modes;
3. testing becomes difficult, because transport and orchestration are not isolated behind narrower interfaces.

The existing constants show where runtime pain is already surfacing:

- `MAX_TOOL_CALL_DEPTH = 12`
- `MAX_TOOL_RESULT_CHAR_BUDGET = 12000`
- `MAX_READ_FILE_CHAR_BUDGET = 8000`
- repeated cached core-call reuse thresholds

Those are sensible safety valves, but they are also symptoms that the runtime is compensating for oversized responsibilities and potentially oversized payloads upstream.

### 2. Conversation memory is being compacted defensively, which signals storage and prompt pressure

`app/src/shared/lib/agent/conversationMemory.ts` shows a second layer of pressure management:

- `MAX_PROMPT_MESSAGES = 8`
- `MAX_STORED_MESSAGES = 20`
- `MAX_SUMMARY_CHARS = 3200`
- `MAX_ARTIFACT_PAYLOAD = 12000`
- selective artifact capture for `read_file` and large query tools

This is a reasonable brownfield evolution, but it means the system currently depends on multiple lossy compression layers:

- truncation in `chatAgent.ts`
- artifact externalization in `artifactStore.ts`
- rolling summaries and recent-message caps in `conversationMemory.ts`

That layered compression helps the app survive, but it also creates hidden coupling between memory quality, prompt quality, and tool execution behavior. Performance improvements here will likely come from architectural separation first, not only from tweaking thresholds.

### 3. `app/src/features/biz-data/services/bizDataService.ts` does heavy client-side aggregation

The business data path currently:

- paginates entire Supabase result sets into arrays using repeated `range(...)` loops;
- fetches `edu_biz_report`, `edu_org_hierarchy`, and `edu_biz_monthly_plan` into memory;
- merges them into node maps;
- computes derived metrics such as margins and ratios on the client;
- constructs synthetic aggregate nodes for total / level1 / level2;
- rebuilds tree and nested hierarchy structures from the full in-memory dataset.

Specific implications:

- frontend memory pressure grows with reporting volume;
- the same derived work is repeated per page/view interaction;
- the WebView process pays both data-transformation cost and rendering cost;
- expensive hierarchy building can affect perceived responsiveness on weaker desktop/mobile devices.

The file is not badly written, but the location of the work is the issue. A business-reporting app with hierarchical aggregation usually wants more of this work pushed closer to the data boundary, cached, or at least incrementally computed.

### 4. `app/src/shared/lib/httpClient.ts` is too thin for observability-driven optimization

The current abstraction only decides:

- use fetch in browser/dev;
- use `@tauri-apps/plugin-http` in Tauri;
- rewrite some dev requests through a local proxy prefix.

That keeps call sites clean, but it also means the app has no common place for:

- timing instrumentation;
- request classification;
- retry policy;
- runtime-specific error normalization;
- slow-request logging.

The optimization cost here is not that the file is slow. It is that the project lacks a stable choke point for measuring runtime behavior across browser and Tauri execution paths.

## Priority Findings

### P0. Centralized Agent runtime complexity in `app/src/shared/lib/agent/chatAgent.ts`

- **File paths:** `app/src/shared/lib/agent/chatAgent.ts`, `app/src/shared/lib/agent/conversationMemory.ts`, `app/src/shared/lib/agent/conversationStore.ts`
- **Problem statement:** provider transport, stream parsing, tool execution orchestration, cache controls, and payload compaction are concentrated into one operational class.
- **Likely impact:** slow engineering iteration, high regression risk, and difficulty introducing better performance instrumentation or targeted tests.
- **Why it matters later:** Phase 2 cannot safely decompose runtime boundaries, and Phase 3 cannot reliably optimize the hot path, until this concentration is made explicit and broken into modules.

### P0. Frontend-side hierarchical aggregation in `app/src/features/biz-data/services/bizDataService.ts`

- **File paths:** `app/src/features/biz-data/services/bizDataService.ts`, `app/src/features/biz-data/api/bizDataRepository.ts`
- **Problem statement:** the app fetches large reporting datasets and performs multi-step aggregation, metric derivation, and tree-building inside the frontend process.
- **Likely impact:** higher memory use, avoidable CPU work in the WebView, and degraded responsiveness as dataset size grows.
- **Why it matters later:** Phase 3 needs a concrete target for moving, caching, or reducing this work rather than only “optimize rendering.”

### P1. Multiple lossy context-compression layers across the Agent path

- **File paths:** `app/src/shared/lib/agent/chatAgent.ts`, `app/src/shared/lib/agent/conversationMemory.ts`, `app/src/shared/lib/agent/artifactStore.ts`
- **Problem statement:** the system uses truncation, compaction, summarization, artifact externalization, and recent-message caps simultaneously.
- **Likely impact:** possible loss of context quality, subtle behavior drift, and a hard-to-measure tradeoff between performance and answer fidelity.
- **Why it matters later:** Phase 3 needs to decide which compression layers are strategic and which are compensating for missing structure.

### P1. Missing runtime-level instrumentation around HTTP and tool execution

- **File paths:** `app/src/shared/lib/httpClient.ts`, `app/src/shared/lib/agent/chatAgent.ts`
- **Problem statement:** there is no standard measurement path for request latency, tool latency, provider latency, or payload size by runtime.
- **Likely impact:** optimization work risks being intuition-driven rather than evidence-driven.
- **Why it matters later:** Phase 1 baseline should define what to measure before Phase 3 begins making performance claims.

### P2. Browser-storage growth and local artifact persistence remain soft ceilings

- **File paths:** `app/src/shared/lib/agent/conversationStore.ts`, `app/src/shared/lib/agent/artifactStore.ts`, `app/src/shared/storage/createBrowserStore.ts`
- **Problem statement:** storage is better structured than before, but it is still browser-storage based and subject to local limits and serialization overhead.
- **Likely impact:** long conversations and artifact-heavy sessions may continue to push client-side storage and hydration costs upward.
- **Why it matters later:** this is less urgent than runtime decomposition, but it should remain visible in the performance backlog.

## Optimization Opportunities

### Separate runtime roles before tuning micro-costs

The biggest performance enabler is likely architectural:

- split provider transport from tool orchestration;
- split payload compaction from execution flow;
- split memory shaping from stream parsing;
- make tool execution accounting independently testable.

That makes later optimization measurable and reversible.

### Instrument the path that already hurts

The app should be able to answer:

- which tools are called most often;
- average tool result size before and after compaction;
- repeated-tool-loop frequency;
- average provider latency by model/provider;
- conversation memory size over time;
- data-fetch + hierarchy-build time for business reporting pages.

Without that, performance work will stay partly anecdotal.

### Reduce repeated whole-dataset work in the business-data path

Candidate directions include:

- pre-aggregated server-side views/materialized tables;
- narrower repository queries by view mode;
- memoized tree construction keyed by dataset version;
- incremental aggregation instead of rebuilding every structure from scratch;
- moving expensive transforms out of UI-facing hooks/pages.

### Normalize “performance budget” decisions explicitly

Several current limits are already effectively budgets. They should become named design choices:

- prompt-message caps;
- artifact-payload caps;
- tool-result character budgets;
- hierarchy preview node limits;
- metric preview limits.

If those remain scattered constants, later changes will be hard to reason about.

## Recommended Follow-up

| Finding | Target phase | Suggested action | Dependencies |
|---|---|---|---|
| Centralized `chatAgent.ts` runtime | Phase 2 | Split `chatAgent.ts` into provider client, stream parser, tool-run loop, and result-compaction modules with stable interfaces | Phase 1 baseline approved |
| Frontend-heavy `bizDataService.ts` aggregation | Phase 3 | Measure fetch/transform cost, then move or cache high-cost hierarchy aggregation closer to data boundaries | Phase 1 runtime/performance review |
| Layered context compression | Phase 3 | Inventory each truncation/summary layer and decide which ones are essential versus compensating for architecture debt | Phase 2 runtime decomposition plan |
| Missing runtime instrumentation | Phase 3 | Add timing and payload instrumentation around HTTP, provider calls, and tool execution | Phase 2 interface cleanup helps avoid instrumentation scattering |
| Browser-storage artifact pressure | Phase 3 | Evaluate whether long-lived conversation artifacts should move to a more explicit storage boundary or stricter retention policy | Runtime metrics and storage-volume observation |
| Verification missing around runtime hot path | Phase 5 | Add unit-level coverage for compaction, cache reuse rules, and tool-loop protection before aggressive runtime refactors | Phase 2 module extraction |

