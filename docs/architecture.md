# KnowFlow 一期架构与数据职责

依据已发布基线 `f8f761e`（2026-11-13 只读核查），不以本地二期工作区代表线上。产品流程见 [一期 PRD](prd/PRD.md)，版本依据见 [项目现状](current-status.md)。

## 运行结构

一期为 Next.js 16.4.0／React 19／TypeScript 单体 Web，Prisma 6 管理 SQLite，独立 Node Worker 执行错题与目录后台任务；上传和 Skill 文件使用持久目录。原有图谱使用 vis-network。现有生产编排为 Docker Compose + Caddy，Web/Worker 共用数据库、文件与镜像。

浏览器选择/校对 → Web 校验并保存原图、记录与任务 → Worker 调用 AI → 保存候选或整理结果 → 页面查询状态 → 用户确认关联、补充复盘。浏览器不是后台执行器。

## 正式数据来源

| 数据 | 一期正式存储 | 说明 |
| --- | --- | --- |
| 学科、章节、知识点与关系 | SQLite Subject、Chapter、KnowledgeNode、KnowledgeNodeRelation | 教材树、分区、状态、理解和关联，不是内置 MD 骨架 |
| 错题正文、答案、复盘 | SQLite MistakeItem 及结构化分析字段 | selfReport 必须保护；原照片另存 |
| 笔记正文、标签与关联 | SQLite Note 及关联表 | 内容可含图片/文件链接语法，不代表 MD 文件为正式来源 |
| 学习时长、任务、每日总结 | StudySession、Task、DailyReview | 记录统计与模型/规则摘要，不等于能力测评 |
| 知识复习 | KnowledgeNode 的等级、状态及复习时间字段 | 一期不是独立的新版 ReviewEvent 模型 |
| 错题/目录任务与租约 | MistakeJob、CatalogJob、WorkerLease | 持久状态、重试、检查点与任务恢复 |
| AI 额度 | AiUsageDay | 调用次数预算，不是金额保证 |
| 上传及 Skill 档案 | 持久 uploads、mistake-skill 目录 | 需要连同数据库备份，不能只备份路径 |

一期没有新增内容服务中的 ContentDocument/ContentLink、LearningMaterial、PracticeAttempt 等模型。它们属于二期实验，不作为一期架构。

## 可靠性与异常边界

错题上传后记录与任务先保存；Worker 以租约领取，检查输入版本，有限重试并复用识别检查点。用户卡点/错因不随新 AI 分析整体覆盖。教材任务按页保存，ready 表示预览完成，确认导入与候选识别分开。替换教材归档旧节点，保留历史关联。

认证与请求校验保护页面、API、照片和导出；来源、请求大小、超时、并发和额度复用现有机制。每日复盘模型失败可降级为基于当日记录的摘要；笔记分类接口存在自动新增节点行为，需要在产品限制中披露。

## 代码与目录职责

| 位置 | 一期职责 |
| --- | --- |
| app/src/app | 页面和 API，原有 knowledge/notes/wrong-questions 等路由 |
| app/src/components | 知识库、GraphView、照片录入、复习卡片与共享界面 |
| app/src/lib | AI、队列、认证、请求限制与数据处理 |
| app/prisma | 一期模型、增量迁移；不能用当前二期 schema 代替发布基线 |
| app/scripts | Worker、初始化和配置工具 |
| app/vendor/mistake-learning | 历史诊断及导出兼容，不是录入必经流程 |
| app/tests、app/public | 验证脚本与运行资源 |
| deploy、compose.yaml | 部署模板和编排，私有实际配置不提交 |
| scripts | 服务器备份、校验、下载与恢复 |
| docs、assets、tools | 文档、源素材与独立实验；实验不等于上线 |
| data | 私有数据、快照及验证证据，Git 忽略 |

关键入口：`mistake-service.ts`、`mistake-queue.ts`、`catalog-queue.ts` 位于 app/src/lib；`app/scripts/mistake-worker.ts` 执行后台；`app/src/components/knowledge/GraphView.tsx` 为一期图谱；`app/src/app/api/backup/route.ts` 为结构化导出与受限恢复。

保留现有目录，不搬动代码。查看一期时使用 Git 指定提交，不把本地新增 pilot/materials 文件当作一期的一部分。

## 备份与发布

设置 JSON 导出包含相关业务表及关系，不含照片/PDF 本体，也不覆盖所有运行数据；完整服务器快照保存一致性 SQLite、上传与 Skill 文件。程序、私有配置与证书另保留。恢复需要校验、停写和原数据保护，不能因为有脚本就认为完整灾备已验收。

工程运行见 [开发说明](development.md)，生产步骤见 [部署说明](aliyun-deployment.md)。二期 MD/反向链接架构只保留在 [规划参考](content-storage.md)，不纳入一期成果。
