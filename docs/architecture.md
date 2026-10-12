# KnowFlow MVP 架构

## 运行边界

Next.js 16 App Router + React 19 + TypeScript；Prisma 6 访问 SQLite。Web 和独立 Node Worker 共用数据库与上传目录。SQLite 内 `MistakeJob` 持久队列、`WorkerLease` 单 Worker 租约，无 Redis 或外部任务基础设施。

## 核心流程与代码

| 流程 | 主要入口 |
| --- | --- |
| 手机多页、旋转裁剪、压缩、IndexedDB草稿 | `MultiImageIntake.tsx`、`mistake-image.ts` |
| 上传校验及留图、一次记录与任务、幂等 | `/api/upload`、`mistake-service.ts`、`mistake-pages.ts` |
| 租约领取、有限重试、重启恢复、版本保护 | `mistake-queue.ts`、`scripts/mistake-worker.ts` |
| 题干/手写识别，再生成卡片与已有节点推荐 | `mistake-ai.ts`、`mistake-recognition.ts`、`mistake-contract.ts` |
| 状态回看、原图、公式及可编辑复习卡片 | `ProcessingStatus.tsx`、`MistakeDetail.tsx`、`ReviewCard.tsx`、`MathText.tsx` |
| 教材名称、照片目录预览与确认追加 | `/api/subjects/[id]/catalog`、`textbook-catalog.ts` |
| 完整诊断、上下文和 Word 导出 | `mistake-skill.ts`、`vendor/mistake-learning` |
| 历史及多关联备份恢复 | `/api/backup`、`scripts/export-cloud-data.py` |

上传成功指照片、错题和任务均持久化；浏览器只查询状态，不承担后台任务。AI 失败不会删除原图。识别不清、多道题或证据不足阻止确定性诊断；个人错因保持未确认，允许简短补充与事后修改。现有关联数量受接口校验限制，以实际代码为准，不能视作任意数量的自动关联已完成。

## 数据模型

`Subject` 管理主教材；`KnowledgeNode.parentId` 构成章节树，`KnowledgeNodeRelation` 存横向关系。`MistakeItem` 保存分析及状态，旧 `knowledgeNodeId`/`imageUrl` 保留兼容，多知识点通过 `MistakeNodes` 多对多关系，有序多页通过可空 JSON `imageUrls`。`MistakeJob` 记录任务及重试，版本字段避免后台旧结果覆盖人工修改。笔记、任务、学习记录沿用现有模型，完整字段见 `app/prisma/schema.prisma`。

目前部分 AI/Skill 结果是结构化 JSON 字符串，未引入新存储服务。图片及 Skill 原始记录落本地持久目录，数据库不保存图片二进制。Web 与 Worker 的 `DATABASE_URL`、`UPLOAD_ROOT`、Skill 数据路径必须一致。

## 部署和限制

Docker/Compose 复用同一应用镜像，Web 启动前迁移、Worker 独立运行，Caddy 提供 HTTPS 与基本访问保护。代码模板已提供，实际 Docker/服务器运行及手机 Safari 需独立验收。新增迁移遵循备份→副本测试→旧数据比较→停写迁移→启动验收。

当前是单人持久磁盘部署，不适合无持久磁盘的纯 Serverless、多实例写同一远程 SQLite 或公开多租户。图谱重设计、Obsidian 导出、双向同步不在当前实现内。Skill 来源随项目纳入用于本私有项目，未发现可授权对外再分发的许可证明；不擅自为第三方代码添加开源许可。
