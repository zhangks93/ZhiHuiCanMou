# Phase 1 Research: Optimization Baseline

**Date:** 2026-04-12  
**Scope:** Internal brownfield research for Phase 1 planning

## Research Summary

Phase 1 should focus on producing a high-signal engineering baseline rather than starting refactors immediately. The codebase already exposes enough evidence to identify priority areas:

1. **Agent runtime complexity**
   - `app/src/shared/lib/agent/chatAgent.ts` mixes provider transport, stream parsing, tool-call orchestration, caching, truncation, and loop protection.
   - This is the clearest architecture and maintainability hotspot.

2. **Auth/runtime fragility**
   - The login path crosses Feishu OAuth, Supabase Edge Functions, Supabase Auth, browser callback parsing, Tauri deep-link handling, and session refresh.
   - Failure handling exists, but the path remains distributed and likely fragile across desktop/mobile/web.

3. **Verification gap**
   - Build and lint exist, but there is no mature automated regression net around auth, agent runtime, or data transforms.
   - Any meaningful optimization work without a test/verification floor carries high regression risk.

4. **Repo boundary pressure**
   - Product code, Android generated files, spreadsheets, chart assets, import scripts, and deployment workflows coexist in one repo.
   - This does not block shipping, but it raises navigation cost and weakens architecture clarity.

## Planning Implications

- Split Phase 1 into independent diagnosis workstreams so analysis can proceed in parallel.
- Separate runtime/performance analysis from auth/stability/verification analysis.
- Add a synthesis plan that consolidates both branches into a prioritized baseline report and next-phase execution contract.
- Keep deliverables doc-focused in this phase so later phases can act on evidence instead of intuition.

## Suggested Deliverables

- Runtime and performance review
- Stability and verification review
- Prioritized optimization baseline report

## Validation Architecture

Phase 1 is primarily document-producing, but it should still define the validation floor for future phases:

- Use existing `npm run lint --prefix app` and `npm run build --prefix app` as the minimum current automated checks.
- Identify which future phases require additional unit or integration tests before code changes start.
- Treat the absence of auth/agent automated tests as an explicit Phase 1 finding, not an implicit assumption.

## Recommendation

Proceed without external ecosystem research for this phase. The codebase map and current source files already provide enough evidence for a strong baseline diagnosis, and the immediate need is to convert those findings into executable follow-on phases.
