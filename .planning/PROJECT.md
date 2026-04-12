# 智汇参谋 (Canmou)

## What This Is

智汇参谋是一个基于 Tauri 2、React 19、TypeScript、Supabase 与 Rust 的企业智能助手应用，当前已经覆盖日程、经营数据、商机、组织、考勤、出差与 Agent 对话等核心能力。现阶段的工作重点不是扩展业务面，而是把现有 Agent 与桌面运行时能力做实，系统性提升性能、结构清晰度、稳定性与可验证性。

## Core Value

让用户稳定、快速、可信地通过桌面端智能助手访问关键业务能力与数据，而不是被认证、性能或 Agent 不确定性拖垮体验。

## Requirements

### Validated

- ✓ 用户可以通过 Feishu + Supabase 完成登录并进入应用主界面 — existing
- ✓ 用户可以访问多类业务模块，包括经营数据、组织、商机、考勤、出差与链接导航 — existing
- ✓ 用户可以在应用内使用 Agent 对话能力，并调用受控的数据查询工具与参考资料 — existing
- ✓ 项目可以构建桌面端、Android 包以及 GitHub Pages 展示页 — existing

### Active

- [ ] 建立面向优化工作的工程基线，明确性能、稳定性、结构和验证短板
- [ ] 降低认证链路与桌面 deep-link 流程的脆弱性
- [ ] 重构 Agent 核心运行时，降低单点复杂度并提升可维护性
- [ ] 补齐针对高风险路径的自动化验证能力
- [ ] 为后续 Tauri/Rust/Agent 深化迭代建立更清晰的模块边界与执行路线

### Out of Scope

- 大范围新增业务模块 — 当前优先级是把已有系统做稳做清晰，而不是继续扩面
- 引入全新的后端平台替换 Supabase — 本轮目标是优化现有架构，不是重建技术底座
- 立即进行大规模 UI 重设计 — 除非影响性能、稳定性或关键交互，否则暂不作为主线

## Context

- 当前仓库是典型 brownfield 项目，代码已经覆盖前端、Tauri 壳层、Supabase migration、Edge Functions、Python 导数脚本、发布流水线和静态展示页。
- `.planning/codebase/` 已完成基线映射，明确了几个高价值优化区域：认证复杂链路、`chatAgent.ts` 中心化复杂度、测试覆盖缺失、以及仓库边界不够清晰。
- Rust 层目前更像运行时桥接层，主要负责 deep-link 和插件装配；业务复杂度主要集中在 TypeScript 前端与 Agent runtime。
- Agent 子系统已经开始处理缓存复用、工具调用预算、上下文裁剪与 artifact 外置化，说明性能与上下文成本问题已经真实存在。
- 认证流程横跨 Feishu、Supabase Auth、Supabase Edge Function、Tauri deep-link、浏览器/Tauri session 回调，是最脆弱的高耦合路径。
- 当前仓库缺少成熟自动化测试体系，构建与发布流程存在，但回归验证能力弱。

## Constraints

- **Tech stack**: 以 Tauri 2 + React 19 + TypeScript + Supabase + Rust 为主 — 现有产品已经建立在该栈上，优化应优先兼容现状
- **Brownfield reality**: 需要在已有功能持续可用的前提下优化 — 不能用“推倒重来”换取表面整洁
- **Cross-runtime complexity**: 代码同时运行于浏览器、Tauri WebView、Rust host、Supabase Edge Runtime 与 Python 工具链 — 任何优化都要考虑跨运行时边界
- **Stability first**: 认证链路、Agent 交互和核心数据页面不能因重构产生明显回归 — 这是现有可用性的底线
- **Verification gap**: 当前自动化测试薄弱 — 计划必须优先补齐可验证性，否则后续优化风险过高

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 先做 brownfield codebase map，再初始化规划 | 先理解现有系统，再规划优化相位，避免凭印象拆解问题 | ✓ Good |
| 当前 milestone 以工程优化为主，不以新增业务功能为主 | 用户目标明确指向性能、结构、稳定性与写法优化 | — Pending |
| 规划默认开启 research / plan-check / verifier | 这是高复杂度工程治理任务，前置验证比盲目执行更重要 | — Pending |
| 以可验证的工程改进为交付单位 | 没有验证标准的“优化”容易变成主观重构 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone**:
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after initialization*
