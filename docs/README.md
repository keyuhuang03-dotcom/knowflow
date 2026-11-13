# 文档导航

更新：2026-11-13。文档分为当前需求、实现事实、操作手册和历史证据；同一事实只在对应主文档维护，其他文件链接引用。

## 产品与当前状态

- [产品需求文档](prd/PRD.md)：用户场景、页面入口、八组功能规则、验收标准与实现缺口。
- [核心问题定义（待验证）](prd/KnowFlow-核心问题定义-待确认.md)：用户问题及研究假设，保持草稿身份。
- [当前功能](features.md)：按网站使用流程说明能力与限制。
- [项目现状](current-status.md)：实现范围、已知缺口、验证证据与发布边界。
- [路线图](knowflow-development-roadmap.md)：建议排序，不等于已获准实施。

## 开发、数据与运行

- [目录与放置规则](structure.md)、[架构](architecture.md)。
- [开发与验证](development.md)、[协作规范](../CONTRIBUTING.md)。
- [Markdown 内容、图谱与恢复](pilot-md-limit.md)、[笔记与练习](materials.md)。
- [部署、备份与回滚](aliyun-deployment.md)：既有生产流程；执行前重新核对，不能直接套用为新试点发布方案。
- [视觉规范](knowflow-design-system.md)：网站基调与图谱局部约束。

## 历史与设计资产

- [历史归档](archive/README.md)：日期记录、旧 PRD、旧路线图及旧现状。
- [2026-10-27 交接](KnowFlow-项目交接文档-2026-10-27.md)：保留固定路径，属于历史快照。
- [Word PRD](prd/PRD.docx)、[版本原稿](prd/versions/)、[原型](prototypes/)：历史设计资产，并未自动与当前 Markdown 同步。
- [图标源素材](../assets/icons/source/)、[CI 模板](ci/ci.yml)：文件存在不代表已发布或已启用。

本次盘点的问题、处理与后续清单见 [仓库整理记录](repository-review-20261113.md)。个人数据、截图、恢复副本放在被忽略的 `data/`，不要混入文档正文或 Git。
