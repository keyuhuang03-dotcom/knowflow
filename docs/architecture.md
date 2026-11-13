# KnowFlow 系统与数据架构

更新：2026-11-13，按当前实现核对。产品规则见 [PRD](prd/PRD.md)，使用限制见 [功能说明](prd/PRD.md)。

## 运行组成

Next.js 16.4、React 19、TypeScript 提供页面和 API；Prisma 6 访问 SQLite；Node Worker 消费持久任务；正文和附件使用持久文件目录。现有部署模板使用 Docker Compose 与 Caddy，不采用无持久盘的纯 Serverless，也没有 Redis。

浏览器负责录入、校对和查询；Web 校验请求并保存来源与任务；Worker 在页面关闭后继续处理；用户确认后内容进入知识网络。AI 调用位于服务端，并受额度、超时与结果校验约束。

## 正式来源与可重建范围

| 数据 | 正式来源 | 恢复与职责 |
| --- | --- | --- |
| 内置参考包 | `app/content/math1-limits/`，初始化到内容库 | 包版本、来源、范围和校对状态随内容维护 |
| 新知识点/笔记/错题正文 | vault 中独立 Markdown | 文件是正文来源，不与数据库双重独立编辑 |
| 照片/PDF | vault/附件，旧内容保留原路径 | 文件不存数据库二进制；必须随备份保留 |
| 内容元信息与链接索引 | ContentDocument、ContentLink | 从有效 MD 重建；重建遇重复 ID/断链不能静默接受 |
| 学习进度/复习事件 | LearningProgress、ReviewEvent | 个人状态，不能靠正文推算；状态快照或完整备份恢复 |
| 写入日志、AI 候选、任务与额度 | 对应 SQLite 运行表 | 不是可随意删除的搜索缓存；完整备份保留 |
| 资料候选及已确认练习题集 | LearningMaterial | 笔记确认后候选仅作历史；练习题集当前以此为准 |
| 练习作答 | PracticeAttempt | 完整备份包含；知识进度 JSON 暂不包含 |
| 历史教材、笔记、错题、时长等 | 原有 SQLite 模型及文件 | 保持兼容访问，未批量迁移 |

## 三条写入链路

**错题：** 上传照片 → 保存 MistakeItem 与 MistakeJob → Worker 识别题干、生成解答 → 推荐已有知识点 → 用户校对与确认。新版正文写 MD，旧列表只保留必要运行/兼容索引；历史错题仍走旧路径。MistakeJob、WorkerLease、输入版本与检查点用于恢复及防止旧结果回写。

**笔记：** 手工编辑或照片/PDF → LearningMaterial 持久候选 → 用户校对正文与关联 → 内容锁下写 MD 并更新索引。Worker 以租约和版本条件领取/提交，确认后不重新覆盖笔记正文。

**练习：** 图片/PDF → LearningMaterial 识别候选 → 校对确认题集 → PracticeAttempt 记录作答 → 收入错题时生成独立 MD、来源引用与知识关联。不会把练习题集伪装成已实现的 MD 题库。

教材目录使用 CatalogJob 的独立队列：ready 表示预览就绪，用户确认导入后才算保存，旧目录与关联保留。

## 并发与正文保护

MD 写入共享跨进程文件锁；ContentOperation 记录待完成操作，文件原子替换后更新索引，并在后续操作恢复中断写入。用户提交携带版本/哈希，重复操作通过稳定编号收敛；旧版本不能覆盖新正文。

错题后台检查分析输入及目标区块；用户已修改题干、解答或标识不完整时保存候选，不自动逐句合并。用户标题、卡点、错因和确认关联不属于可任意覆盖区域。具体区块与冲突规则见 [内容说明](content-storage.md)。

## 模块定位

| 职责 | 代码位置 |
| --- | --- |
| 导航与首页 | `app/src/components/knowledge/home/KnowledgeSidebar.tsx`、`app/src/app/page.tsx` |
| 数学图谱、正文编辑 | `app/src/components/pilot/`、`app/src/lib/pilot/`、`app/src/app/api/pilot/` |
| 照片错题、后台与识别 | `app/src/components/wrong-questions/`、`app/src/lib/mistake-*.ts` |
| 笔记与练习 | `app/src/components/materials/`、`app/src/lib/materials/`、`app/src/app/api/materials/` |
| 全队列 Worker／仅资料 Worker | `app/scripts/mistake-worker.ts`、`app/scripts/material-worker.ts` |
| 认证、请求与额度保护 | `app/src/lib/auth.ts`、`request-guard.ts`、`release-controls.ts`（后两者同目录） |
| 数据模型与迁移 | `app/prisma/schema.prisma`、`app/prisma/migrations/` |
| 内容环境与恢复 | `app/scripts/pilot-env.ts`、`pilot.ts`、`pilot-snapshot.ts`、`pilot-backup.py`（同目录） |

现有 `pilot` 命名是代码与脚本名称；产品入口仍是网站知识库、笔记和练习，不需要另建一套导航。

## 运行隔离、备份与发布边界

新内容服务检查 KNOWFLOW_PILOT、数据库与附件目录是否一致，错误配置拒绝写入。完整快照保存对应 SQLite 与 vault；恢复到新目录并校验，再决定切换。设置旧 JSON、知识状态 JSON 与完整快照的覆盖范围不同，不能互相替代。

PDF 转图片依赖 Poppler；MD 锁依赖当前 Python/OS 工具链。未来 App/跨平台实现需另行适配。新页面存在不等于普通启动即可调用其服务；发布前须核对启用策略、依赖、增量迁移和恢复，不靠文档修改改变代码行为。

认证、资源访问和请求保护继续复用既有机制；单人应用不等于已具备多人数据隔离。操作说明见 [开发说明](development.md)。

## 仓库目录职责

| 目录 | 放置内容 |
| --- | --- |
| app/src/app、components、lib | 页面/API、组件、业务服务；页面保持薄入口 |
| app/content | 随版本维护的内置参考包，不存个人笔记 |
| app/prisma、scripts、tests | 模型与增量迁移、应用后台与维护脚本、隔离测试 |
| app/public | 运行所需可分发静态资源 |
| app/vendor/mistake-learning | 历史 Skill 兼容代码、模板及依赖，不能当无用文件清理 |
| deploy、compose.yaml | 生产配置模板与容器编排 |
| scripts | 仓库级生产备份、传输、恢复及运维工具 |
| assets、tools | 源素材和独立工具；实验不等于已接入或可发布资源 |
| docs/prd、docs/archive | 当前需求与研究草稿、保留的历史证据 |
| data | 私有数据、备份和截图等验证产物，Git 忽略 |

npm/Next 项目位于 app，但生产 Docker 构建上下文为仓库根，不能直接套用托管平台的 Root Directory=app 配置。现有 pilot/materials 模块名称与导入路径保持原样，不为目录整齐搬动业务代码或持久目录。

资料模块的数据迁移为 `app/prisma/migrations/20261105000000_learning_materials/`，契约测试在 `app/tests/materials.test.ts`；LegacyNotes 保留旧笔记界面。LearningMaterial.draft 在笔记确认后仅留历史候选，但已确认练习题集仍以该字段为正式来源。
