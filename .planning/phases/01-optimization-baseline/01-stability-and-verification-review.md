# Stability And Verification Review

## Executive Summary

The most fragile runtime in this repository is the authentication path, not because any one file is obviously broken, but because the flow is distributed across too many runtime boundaries. A single login may involve Feishu OAuth, a Supabase Edge Function, Supabase Auth admin APIs, magic-link generation, browser URL parsing, Tauri deep-link handling, desktop event forwarding, and frontend session restoration. Each layer contains defensive code, but the flow as a whole still has too many state transitions to be considered predictable.

The second conclusion is that the current verification posture is below what this codebase now needs. The project already contains cross-runtime behavior and a non-trivial Agent execution loop, yet the visible automated checks remain lint/build/release validation. That is not enough to protect auth hardening, runtime decomposition, or performance work in later phases.

A useful Phase 1 outcome, therefore, is not only a list of bugs to fix. It is a clear definition of where the system can fail, what symptoms users see when it fails, and which automated checks must exist before deeper refactors begin.

## Failure Modes

### 1. Callback parameter parsing is flexible but hard to reason about

- **File path:** `app/src/features/auth/services/authCallbackService.ts`
- **Risk:** `parseAuthCallbackParams` merges values from full URL, search string, and hash parsing through multiple helper passes. That makes the parser tolerant, but also harder to prove correct across browser, mobile, and desktop callback variants.
- **Likely symptom:** callback succeeds on one platform shape but fails or behaves ambiguously on another URL form; debugging relies on log output rather than a constrained parser contract.
- **Stabilization direction:** define one canonical callback format per platform and test parser behavior against explicit fixtures instead of merging every possible source path ad hoc.

### 2. State validation is split between client and server responsibilities

- **File paths:** `supabase/functions/feishu-callback/index.ts`, `app/src/features/auth/services/authCallbackService.ts`
- **Risk:** the edge function requires `state` to exist but explicitly delegates real validation to the client path. That means server-side guarantees are weaker than they appear, and the callback chain depends on a later client step to confirm intent.
- **Likely symptom:** inconsistent CSRF expectations, harder incident analysis, and uncertainty about where auth rejection should occur.
- **Stabilization direction:** make the trust boundary explicit and either strengthen server-side validation or deliberately simplify the contract so both layers do not imply they are the final authority.

### 3. Desktop OAuth completion depends on event bridging rather than a tighter handshake

- **File paths:** `app/src/features/auth/services/tauriOAuthService.ts`, `app/src/features/auth/services/authCallbackService.ts`, `app/src/features/auth/pages/AuthCallbackPage.tsx`
- **Risk:** desktop mode emits `auth:oauth-complete`, waits, and then closes the window after a timeout. Success depends on event delivery, listener registration timing, and session application all lining up.
- **Likely symptom:** desktop login intermittently appears to hang, closes too early, or leaves the session unset even though tokens were present.
- **Stabilization direction:** replace timeout-oriented flow with a clearer completion handshake and observable success/failure states between the callback window and main window.

### 4. Tauri deep-link retry behavior is resilient but opaque

- **File path:** `app/src-tauri/src/lib.rs`
- **Risk:** `handle_deep_link` retries failed navigation through recursive re-entry on a spawned thread with a shared retry counter. That makes the path fault-tolerant, but it is still stringly typed, event-driven, and only loosely modeled as a state machine.
- **Likely symptom:** duplicate processing, unclear retry causes, or difficult-to-replay failures when the main window is not ready or script evaluation fails.
- **Stabilization direction:** model the deep-link path as an explicit state machine or at least isolate parse, validate, navigate, retry, and emit-error phases into narrower functions.

### 5. Session restoration and refresh logic is distributed and log-driven

- **File paths:** `app/src/features/auth/services/authSessionService.ts`, `app/src/app/providers/AuthProvider.tsx`
- **Risk:** session recovery, scheduled refresh, immediate refresh, refresh-in-progress flags, and auth-state subscription all live in cooperating functions without a unified auth lifecycle model.
- **Likely symptom:** duplicate refresh attempts, stale-token edge cases, hard-to-reproduce race conditions after startup or callback completion.
- **Stabilization direction:** define explicit auth lifecycle states and transitions, then test the expected behavior around recovery, refresh scheduling, and refresh failure.

### 6. Edge-function user lookup scales poorly and mixes auth concerns

- **File path:** `supabase/functions/feishu-callback/index.ts`
- **Risk:** the callback path lists up to 1000 users and scans in memory to find matches before creating or updating a user. That is operationally simple but couples login latency to admin-list behavior.
- **Likely symptom:** slower auth callback under growth, harder operational tuning, and increased pressure on a path that should stay minimal.
- **Stabilization direction:** move toward a more direct lookup strategy or a stronger identity-linking boundary instead of list-and-scan within the login flow.

### 7. Refresh semantics are only partially explicit

- **File paths:** `supabase/functions/feishu-refresh/index.ts`, `app/src/features/auth/services/authSessionService.ts`
- **Risk:** the refresh edge function currently treats Supabase session refresh as sufficient and leaves Feishu-specific refresh as future work. The frontend also refreshes directly through `supabase.auth.refreshSession()`.
- **Likely symptom:** unclear ownership of refresh behavior, duplicated refresh pathways, and future confusion when Feishu token lifecycle requirements become stricter.
- **Stabilization direction:** document the intended token authority clearly and reduce duplicate refresh paths where possible.

## Verification Gaps

The current repository map shows no mature automated test suite around the most brittle paths. For the next optimization phases, the missing checks are not optional nice-to-haves. They are prerequisite safety rails.

### Missing auth checks

- parser fixtures for callback URLs in hash/query/combined forms
- state-validation tests for valid, invalid, and missing state
- session recovery tests for stored token present / missing / invalid
- session refresh scheduling tests around threshold timing and “already refreshing” logic
- desktop event-bridge tests for `auth:oauth-complete` delivery and failure handling

### Missing Tauri/deep-link checks

- deep-link parsing tests for missing params and malformed callback URLs
- retry-behavior tests or equivalent functional checks around navigation failure
- window-not-found handling verification for `app/src-tauri/src/lib.rs`

### Missing agent runtime checks

- unit tests for tool-result truncation and hierarchy compaction behavior
- coverage for repeated cached core-call reuse protection
- coverage for max tool-call depth behavior
- provider-branch tests that validate OpenAI-compatible and Claude flow divergence

### Missing data-transformation checks

- business-data aggregation tests for derived metrics, synthetic nodes, and tree shape
- regression checks for `aggregateByNode`, `buildTreeWithAggregation`, and `buildNestedHierarchy`

## Priority Findings

### P0. Distributed auth chain lacks a single, testable source of truth

- **File paths:** `supabase/functions/feishu-callback/index.ts`, `app/src/features/auth/services/authCallbackService.ts`, `app/src/features/auth/services/tauriOAuthService.ts`, `app/src/features/auth/services/authSessionService.ts`, `app/src-tauri/src/lib.rs`
- **Problem statement:** login success currently depends on multiple loosely coordinated transitions across server, browser, and desktop runtime boundaries.
- **Likely impact:** intermittent auth failures will be difficult to root-cause and risky to refactor.
- **Why it matters later:** Phase 4 hardening work should not begin without a shared failure-mode map and explicit test targets.

### P0. Verification coverage is missing exactly where the architecture is most fragile

- **File paths:** `.planning/codebase/TESTING.md`, `app/src/shared/lib/agent/chatAgent.ts`, `app/src/features/auth/pages/AuthCallbackPage.tsx`
- **Problem statement:** the most stateful and failure-prone paths do not appear to have dedicated automated coverage.
- **Likely impact:** later optimization phases may introduce regressions that only surface during manual testing or production use.
- **Why it matters later:** Phase 5 exists because this gap is structural, not incidental.

### P1. Desktop OAuth completion uses timing and event assumptions

- **File paths:** `app/src/features/auth/services/authCallbackService.ts`, `app/src/features/auth/services/tauriOAuthService.ts`
- **Problem statement:** the desktop callback path emits an event and closes the window after a fixed timeout instead of confirming end-to-end session establishment.
- **Likely impact:** unstable desktop-specific behavior and difficult bug reproduction.
- **Why it matters later:** Phase 4 should convert this into an explicit completion contract.

### P1. Tauri deep-link handling is resilient but not easily verifiable

- **File path:** `app/src-tauri/src/lib.rs`
- **Problem statement:** retry logic exists, but its behavior is not separated into easily testable units and relies on string parsing plus delayed recursion.
- **Likely impact:** recovery behavior may drift over time without anyone noticing.
- **Why it matters later:** Rust-side hardening should prioritize explicit state transitions over ad hoc retries.

### P2. Auth observability is still mostly console-driven

- **File paths:** `app/src/features/auth/pages/AuthCallbackPage.tsx`, `app/src/features/auth/services/authSessionService.ts`, `app/src-tauri/src/lib.rs`
- **Problem statement:** diagnostics are visible in logs and debug panels, but not normalized into a stable telemetry or structured event model.
- **Likely impact:** debugging remains possible, but operational learning stays local and manual.
- **Why it matters later:** once the higher-priority failures are modeled, observability can be made more systematic.

## Recommended Follow-up

| Finding | Target phase | Suggested action | Dependencies |
|---|---|---|---|
| Distributed auth chain | Phase 4 | Write a unified auth/deep-link state model covering callback parse, server exchange, desktop event bridge, session set, refresh, and recovery | Phase 1 baseline approved |
| Missing automated auth checks | Phase 5 | Add parser, state-validation, recovery, and refresh tests before broad auth refactors | Phase 4 state model clarifies expected behavior |
| Missing automated agent runtime checks | Phase 5 | Add focused tests for compaction, loop protection, and provider-branch execution behavior | Phase 2 module boundaries make isolated tests easier |
| Desktop timeout/event assumptions | Phase 4 | Replace timeout-based window close flow with a positive completion handshake and clearer error propagation | Auth state model and desktop-flow diagnosis |
| Tauri deep-link retry opacity | Phase 4 | Refactor Rust deep-link code into smaller phases with explicit retry intent and clearer failure reporting | Auth/deep-link hardening design |

