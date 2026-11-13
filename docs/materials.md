# 笔记与资料练习试点

更新：2026-11-13，按本地实现核对。适用于隔离试点，尚不代表正式站部署。产品范围见 [PRD](prd/PRD.md)。

## 用户流程

笔记：照片或 PDF 先保存 → 创建持久任务 → AI 转录和推荐已有知识点 → 用户校对正文/多个标签 → 确认生成独立 MD → 从笔记与图谱找回。确认后 MD 为正文来源，数据库候选不再是可独立编辑的正文。历史笔记通过 `/notes?legacy=1` 访问。

练习：上传资料 → 提取原题、原选项、原答案及页码 → 校对并确认 → 在线作答 → 判题或自评 → 可收入错题。不自动创作新题，不把学生手写作答作为答案；缺少答案时保留为空。只有存在源答案的单选题自动判定，其他题型及缺答案的题目由用户自评。

## 数据职责

| 数据 | 正式位置与保护 |
| --- | --- |
| 原照片/PDF | 试点 vault/附件；后台失败不删除原件 |
| 笔记、收入错题的正文 | vault 中独立 MD；复用内容锁、操作恢复和索引机制 |
| 识别候选与队列状态 | SQLite LearningMaterial；租约、版本条件与有限重试 |
| 已确认练习题集 | SQLite LearningMaterial.draft；这是当前实现，不是 MD 题库 |
| 逐次作答 | SQLite PracticeAttempt；完整备份包含，进度 JSON 暂不包含 |
| 图谱及反向链接 | MD 与元信息生成的 ContentDocument/ContentLink 索引 |

用户确认笔记后后台不重写正文；确认检查候选版本。校对界面不会被后台轮询替换，但当前校对输入未持久自动保存，刷新仍可能丢失未确认修改。不要将原图保存成功等同于所有后续编辑已经保存。

## 运行与限制

在 `app/` 启动 `npm run pilot:dev` 和 `npm run pilot:worker`。只需处理资料任务时可用 `npm run pilot:materials-worker` 替代完整 Worker；仅运行该进程不会处理旧错题/目录队列。首次初始化和环境隔离见 [开发说明](development.md)。

PDF 依赖 Worker 可执行的 Poppler `pdfinfo` 和 `pdftoppm`。当前单份 PDF 最多 12 页；图片/PDF 校验、页数、总量及模型时限均有限制，不支持任意附件。AI 使用既有 `MISTAKE_AI_*` 配置，无配置或失败保留材料并允许重试。

未完成：复杂手写与版面系统评测、全题型自动判分、练习历史展示与续做、确认后题集编辑、独立题集可移植导出、校对草稿刷新恢复。

## 代码位置与验证

- 页面：`app/src/app/notes/page.tsx`、`app/src/app/practice/page.tsx`。
- 界面：`app/src/components/materials/`；旧笔记保存在 LegacyNotes。
- 服务：`app/src/app/api/materials/route.ts`、`app/src/lib/materials/{contract,recognize,service}.ts`。
- 数据：`app/prisma/schema.prisma`，迁移 `20261105000000_learning_materials`。
- 后台：`app/scripts/material-worker.ts` 与既有 `mistake-worker.ts`。
- 检查：`app/tests/materials.test.ts`；前轮本地集成证据在被忽略的 `data/material-review/`。

前轮记录包括四个视口、任务恢复、MD 与关联、简单真实图片/PDF 及隔离备份恢复。本轮只核对记录与代码，不将历史通过写成重新执行。完整恢复流程见 [试点文档](pilot-md-limit.md)，恢复必须使用新目录，避免覆盖后续上传。
