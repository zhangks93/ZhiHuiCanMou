# 数据公开暴露排查与处置

本仓库已将 GitHub Pages 发布产物与私有业务数据目录分离，但历史 commit、历史 Pages artifact、历史 Release artifact 仍需要人工排查。

## 检查 GitHub Pages artifact

1. 打开仓库 `Actions` 页面。
2. 查看历史 `Deploy GitHub Pages` 运行记录。
3. 下载历史 artifact，确认是否包含 `docs/data/`、`.xls`、`.xlsx`。

## 检查 Release artifact

1. 打开仓库 `Releases` 页面。
2. 检查每个 Release 的附件是否包含业务 Excel 或导出的敏感 CSV。
3. 如发现风险文件，手工删除对应 Release asset。

## 检查 Git 历史

```bash
git log --stat -- docs/data
git log --all --name-only -- '*.xls' '*.xlsx'
git rev-list --objects --all | rg 'docs/data|\\.xls$|\\.xlsx$'
```

## 发现已公开暴露后的建议动作

1. 清理 GitHub Pages artifact。
2. 清理 Release artifact。
3. 评估是否需要重写 Git 历史。
4. 如仓库曾公开，轮换相关密钥与访问凭据。

## 人工审批边界

- Git 历史重写
- 生产密钥轮换
- 已公开发布记录的法律/合规处置

以上动作不应由 CI 或自动脚本直接执行。
