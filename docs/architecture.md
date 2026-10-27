# KnowFlow 当前架构

当前运行状态见 [项目现状](current-status.md)。历史实现记录见 [归档](archive/README.md)，不要再将“未部署”作为架构现状。

## 运行结构

Next.js 16.4 / React 19 / TypeScript；Prisma 6 访问 SQLite。Web 与独立 Node Worker 共用持久数据库、照片和 Skill 目录，Docker Compose 部署，Caddy 提供 HTTPS 和反向代理。没有 Redis，也不采用无持久盘的纯 Serverless。

浏览器上传 → Web 校验并保存照片/错题/任务 → SQLite 持久队列 → Worker 识别与解答 → 保存结果 → 浏览器查询状态、用户校对与确认。

## 关键边界

- 上传成功才表示服务器记录持久化；浏览器负责状态查询，不负责后台执行。
- MistakeJob、CatalogJob 与 WorkerLease 负责租约、有限重试和恢复；inputVersion 防止旧结果覆盖新输入。
- 题干识别与标准解答分开。AI 不推断用户实际错因，selfReport 属于用户，后台与校对必须合并保留最新值。
- 目录后台按页保存进度，ready 仅表示预览完成；用户确认导入后才是 saved。
- 数学/408 分区教材独立；替换目录保留旧节点和历史内容，归档节点不当作当前教材目录推荐。
- 个人复盘、补充及复习状态在统一保存入口事务写入，不重新调用 AI。

## 代码入口

| 流程 | 文件/目录 |
| --- | --- |
| 多页、压缩、草稿、拖边裁剪 | `app/src/components/wrong-questions/MultiImageIntake.tsx`、`app/src/lib/mistake-image.ts` |
| 上传与持久任务 | `/api/upload`、`mistake-service.ts`、`mistake-queue.ts` |
| Worker | `app/scripts/mistake-worker.ts` |
| 识别、解答与契约 | `app/src/lib/mistake-ai.ts`、`mistake-recognition.ts`、`mistake-contract.ts` |
| 卡片、公式与自填错因 | `MistakeDetail.tsx`、`MistakeReflection.tsx`、`ReviewCard.tsx`、`MathText.tsx` |
| 教材目录 | `CatalogPhotoImport.tsx`、`catalog-ai.ts`、`catalog-queue.ts`、`textbook-catalog.ts`、`/api/subjects/[id]/catalog` |
| 手机最近状态 | `MobileIntakes.tsx`、`recent-intakes.ts`、`/api/recent-intakes` |
| 登录与资源保护 | `auth.ts`、`request-guard.ts`、`release-controls.ts` |
| 数据与迁移 | `app/prisma/schema.prisma`、`app/prisma/migrations` |

组件简名位于对应业务组件目录，服务简名位于 `app/src/lib/`；完整定位表见交接文档。

## 数据与安全

Subject / Chapter / KnowledgeNode 管理教材和树，KnowledgeNodeRelation 管理关系；MistakeItem 保存错题，多页以有序 imageUrls 表示，多知识点关系保留兼容。其他模型包括 Note、StudySession、Task、DailyReview、Resource、AiUsageDay。图片文件不存数据库二进制。部分分析与用户复盘使用结构化 JSON，仍须按契约校验。

页面、API、照片和导出通过应用身份校验；来源、请求体、并发、超时和 AI 次数都有边界。当前是单人应用，没有公开多租户数据隔离。真实 AI 正确率、安全审计和灾备演练不能由模拟测试代替。
