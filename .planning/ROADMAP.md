# Roadmap: 智汇参谋 (Canmou)

**Created:** 2026-04-12
**Scope:** 现有 Tauri 2 Agent 项目的工程优化与治理
**v1 requirements covered:** 10 / 10

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Optimization Baseline | 形成统一的工程诊断、优先级和执行入口 | BASE-01, BASE-02 | 4 |
| 2 | Runtime Architecture Cleanup | 梳理 Agent/runtime/shared 边界并拆解高复杂度模块 | ARCH-01, ARCH-02 | 4 |
| 3 | Performance Pass | 明确并收敛 Agent 与数据路径的主要性能成本 | PERF-01, PERF-02 | 4 |
| 4 | Auth And Stability Hardening | 加固认证、deep-link 和会话恢复路径 | STAB-01, STAB-02 | 4 |
| 5 | Verification Net | 建立针对高风险路径的自动化验证底座 | VERI-01, VERI-02 | 4 |

## Phase Details

### Phase 1: Optimization Baseline

**Goal:** 用可执行的工程诊断替代模糊的“想优化”，形成后续相位的优先级、范围和验收方式。  
**Requirements:** BASE-01, BASE-02  
**UI hint:** no

**Success criteria:**
1. 输出一份覆盖性能、结构、稳定性、测试与仓库治理问题的统一诊断文档
2. 明确列出 P0 / P1 / P2 优化项及依赖关系
3. 指出必须先补的观测与验证缺口
4. 后续各 phase 都能从该基线文档追溯目标来源

### Phase 2: Runtime Architecture Cleanup

**Goal:** 降低 Agent runtime 与 shared 基础设施的中心化复杂度，建立更稳固的模块边界。  
**Requirements:** ARCH-01, ARCH-02  
**UI hint:** no

**Success criteria:**
1. `chatAgent` 相关职责被拆分为可独立理解和测试的模块
2. agent、auth、shared infra 的职责边界有明确文档与代码对应关系
3. 删除或收敛重复实现、隐式耦合和不清晰依赖
4. 关键公共接口比当前更稳定、更容易扩展新 provider / tool / memory 模块

### Phase 3: Performance Pass

**Goal:** 识别并降低 Agent 对话、工具调用和关键数据页面中的性能热点。  
**Requirements:** PERF-01, PERF-02  
**UI hint:** no

**Success criteria:**
1. Agent 对话链路中高成本步骤被量化并给出具体优化动作
2. 至少一类上下文/工具结果膨胀问题得到结构性缓解
3. 关键数据查询或渲染路径的热点被列出并按收益排序
4. 性能优化项与验证方式形成配对，而不是只给主观结论

### Phase 4: Auth And Stability Hardening

**Goal:** 把跨 Feishu、Supabase、Tauri 的认证与会话路径从“能用”提升到“可预测、可恢复”。  
**Requirements:** STAB-01, STAB-02  
**UI hint:** no

**Success criteria:**
1. 认证回调链路中主要失败模式被列出并对应具体处理策略
2. desktop/mobile/web 的回调差异被显式收口或隔离
3. deep-link、会话恢复和刷新逻辑具备更清晰的状态机或等价边界
4. 认证失败时用户和开发者都能获得更明确的诊断反馈

### Phase 5: Verification Net

**Goal:** 为高风险工程路径建立自动化验证能力，让后续优化可持续演进。  
**Requirements:** VERI-01, VERI-02  
**UI hint:** no

**Success criteria:**
1. 为 auth、agent runtime 或数据变换至少建立一组自动化测试
2. 项目存在统一的验证入口，可在本地和 CI 中复用
3. 关键回归风险不再完全依赖手工冒烟发现
4. 后续优化 phase 的完成标准可以直接引用该验证底座

## Coverage Check

- BASE-01 → Phase 1
- BASE-02 → Phase 1
- ARCH-01 → Phase 2
- ARCH-02 → Phase 2
- PERF-01 → Phase 3
- PERF-02 → Phase 3
- STAB-01 → Phase 4
- STAB-02 → Phase 4
- VERI-01 → Phase 5
- VERI-02 → Phase 5

All v1 requirements map to exactly one phase.

---
*Roadmap created: 2026-04-12 after brownfield initialization*
