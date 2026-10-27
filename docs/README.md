# 项目文档索引

## 当前维护文档

- [项目现状](current-status.md)：上线版本、本地/GitHub 状态、验证边界和待办的统一入口。
- [当前功能](features.md)：错题、多页、标准解答、错因、目录与双端体验。
- [完整交接](KnowFlow-项目交接文档-2026-10-27.md)：产品原则、交互重点、代码位置和运维信息。
- [本地开发](development.md)、[协作规范](../CONTRIBUTING.md)。
- [架构](architecture.md)、[部署备份与回滚](aliyun-deployment.md)。
- [视觉规范](knowflow-design-system.md)、[目录结构](structure.md)。
- [路线图](knowflow-development-roadmap.md)：规划资料，不等于已完成功能。

## 已发布迭代记录

这些是按日期保留的验证证据，不能代替最新项目现状。

- [可靠性修复](p0-fixes-20261024.md)
- [目录后台识别](catalog-background-20261026.md)、[目录保存反馈](catalog-save-feedback-20261026.md)
- [拖动裁剪](image-crop-20261026.md)、[统一保存错因](reflection-save-20261026.md)
- [手机录入与紧凑知识库](mobile-experience-20261026.md)

导航统一与筛选栏的发布证据在本机 data/deployment 中，版本和结果见项目现状/交接文档。个人数据、快照与正式页面截图不进入 Git。

## 需求与设计资料

[主 PRD](prd/PRD.md) 和 [Word PRD](prd/PRD.docx) 为产品设计材料；[衍生 Word 版本](prd/versions/) 保留原稿，不视为逐项已实现。原型图保留在 [prototypes](prototypes/)，图标源素材在 [assets/icons/source](../assets/icons/source/)。

## 历史归档

早期向导、首次部署讨论、安全加固及旧仓库整理说明已移到 [archive](archive/README.md)，不再与当前操作手册并列。Git 还保留原始历史。不要按归档中的“未部署”“备案待确认”等文字重新初始化生产环境。

CI 配置仍有 [模板](ci/ci.yml)；是否启用自动检查必须核对实际 GitHub Actions，不能以模板存在为证据。
