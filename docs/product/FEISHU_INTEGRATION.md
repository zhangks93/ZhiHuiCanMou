# 飞书文档解析集成说明

## 概述

工作汇报支持附加飞书文档/表格链接（`work_items.links`）。当前阶段仅存储链接，由用户点击访问。

## 未来扩展：内容解析

若要实现 AI 对飞书文档内容的解析与摘要，需：

1. **飞书开放平台配置**
   - 获取 `app_id`、`app_secret`
   - 开通「文档」权限：`docx:document`、`drive:drive`
   - 开通「电子表格」权限：`sheets:spreadsheet`

2. **后端实现**
   - 新增 Edge Function `feishu-doc-fetch`
   - 根据链接解析 `doc_token` / `sheet_token`，调用飞书文档/表格 API 获取内容
   - 将纯文本内容传入 `ai-summarize` 或 `ai-qa` 作为上下文

3. **权限与安全**
   - 需确保应用有权限访问用户分享的文档
   - 建议仅解析用户主动附加到 work_item 的链接，避免越权访问

## 参考

- [飞书云文档 API](https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/document/raw_content)
- [飞书电子表格 API](https://open.feishu.cn/document/server-docs/docs/sheets-v3/overview)
