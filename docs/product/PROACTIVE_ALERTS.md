# 主动预警机制

## 概述

Phase 2 智能分析页的「经营 × 商机智能匹配分析」为静态洞察。若需**主动推送**预警，可接入定时任务。

## 实现思路

1. **Supabase Cron / pg_cron**
   - 在 Supabase 中配置 pg_cron 或使用外部 cron 服务
   - 定时调用 Edge Function `ai-insights-cron`

2. **Edge Function: ai-insights-cron**
   - 查询 `biz_data`、`opportunities` 等表
   - 规则引擎：达成率 < 70% 触发预警、商机阶段堆积等
   - 可选：调用 LLM 润色洞察文案
   - 将结果写入 `insight_alerts` 表或发送飞书机器人通知

3. **前端展示**
   - Dashboard 或智能分析页轮询/订阅 `insight_alerts`
   - 展示最新预警，支持「已读」状态

## 飞书机器人推送（可选）

- 在飞书开放平台创建「自定义机器人」或使用「应用机器人」
- Edge Function 内调用飞书消息 API，向指定群/人推送预警摘要
