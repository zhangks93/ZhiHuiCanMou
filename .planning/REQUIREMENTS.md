# Requirements: 智汇参谋 (Canmou)

**Defined:** 2026-04-12
**Core Value:** 让用户稳定、快速、可信地通过桌面端智能助手访问关键业务能力与数据，而不是被认证、性能或 Agent 不确定性拖垮体验。

## v1 Requirements

### Baseline

- [ ] **BASE-01**: 团队可以得到一份覆盖性能、结构、稳定性、测试缺口与优先级的代码基线评估
- [ ] **BASE-02**: 优化工作有明确阶段划分、依赖关系与完成标准，而不是零散修补

### Architecture

- [ ] **ARCH-01**: Agent 运行时被拆分为更清晰的模块边界，降低单文件中心化复杂度
- [ ] **ARCH-02**: 共享基础设施与 feature 代码的职责边界更清晰，减少跨层耦合和重复实现

### Performance

- [ ] **PERF-01**: Agent 对话与工具调用链路有明确的性能热点识别与压缩方案
- [ ] **PERF-02**: 数据查询和页面渲染路径中可见的高成本点被梳理，并给出优化次序

### Stability

- [ ] **STAB-01**: Feishu + Supabase + Tauri 的认证回调链路具备更明确的错误边界与回退路径
- [ ] **STAB-02**: Deep-link、会话恢复与自动刷新逻辑具备更高的可预测性，减少平台差异导致的失败

### Verification

- [ ] **VERI-01**: 高风险核心路径具备最小可用的自动化验证方案
- [ ] **VERI-02**: 后续优化相位可以依赖统一的验证入口，而不是纯手工回归

## v2 Requirements

### Product Evolution

- **PROD-01**: 在工程基础稳定后，继续扩展更强的多 Agent 协作能力
- **PROD-02**: 引入更系统的离线缓存、同步和跨端体验优化
- **PROD-03**: 对业务模块做更完整的统一设计与信息架构整理

## Out of Scope

| Feature | Reason |
|---------|--------|
| 全量重写为新的技术栈 | 本轮目标是优化现有系统，不是推倒重建 |
| 一次性改造全部业务模块内部实现 | 需要按风险和收益排序，避免大范围回归 |
| 与优化目标无关的新业务需求扩展 | 会稀释当前 milestone 的工程治理目标 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BASE-01 | Phase 1 | Pending |
| BASE-02 | Phase 1 | Pending |
| ARCH-01 | Phase 2 | Pending |
| ARCH-02 | Phase 2 | Pending |
| PERF-01 | Phase 3 | Pending |
| PERF-02 | Phase 3 | Pending |
| STAB-01 | Phase 4 | Pending |
| STAB-02 | Phase 4 | Pending |
| VERI-01 | Phase 5 | Pending |
| VERI-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 after initial definition*
