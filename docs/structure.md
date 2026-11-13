# 项目目录与放置规则

| 目录 | 内容 |
| --- | --- |
| app/src/app | 页面、布局与 API；运行时公开路由 |
| app/src/components | 业务组件、共享公式/图片/玻璃组件 |
| app/src/lib | AI、队列、图片、数据库、认证与保护 |
| app/prisma | 数据模型与增量迁移；演示 seed 不用于更新 |
| app/scripts | Worker、启动、配置与健康检查 |
| app/public | 实际运行的公开静态资源 |
| app/vendor/mistake-learning | 历史 Skill 兼容代码、模板与依赖 |
| app/tests | 单元、隔离集成和浏览器脚本 |
| deploy、compose.yaml | 配置模板、容器与定时备份服务 |
| scripts | 完整备份、校验、下载、恢复及维护工具 |
| docs | 当前说明、PRD、原型和发布记录 |
| docs/archive | 不再作为当前现状的旧过程文档 |
| assets | 图标原稿、旧图标及模板素材 |
| tools/debug | 独立调试材料 |
| data | 本机私有数据、备份、发布产物与截图，Git 忽略 |

Git 根目录在项目最外层，目标 origin 为 MVP 私有仓库。npm/Next 配置在 app；生产 Docker 构建上下文是项目根，不能照搬一般平台的“Root Directory=app”配置。

新功能说明维护到 features.md；当前部署/仓库结论维护到 current-status.md；操作说明维护到 development/aliyun-deployment。阶段记录保留日期或移入 archive。Word 原稿和原型不因为维护 Markdown 就被删除。

真实 .env、deploy/app.env、实际 Caddyfile、数据库与 WAL、上传和 Skill 个人记录不提交。tools/limit-graph-demo 若存在是本机专用实验，已忽略，该样板不能直接发布；当前 app 内 Reagraph 实现独立维护，样板资产不可据此视为已获分发许可。

## 当前分支补充与整理结果（2026-11-13）

| 位置 | 职责与放置原则 |
| --- | --- |
| app/content/math1-limits | 受版本管理的内置参考包；不是个人 MD 存储目录 |
| app/src/lib/pilot、components/pilot | MD 文件基础、索引、数学工作台与 Reagraph；保留现有命名，暂不迁移导入路径 |
| app/src/lib/materials、components/materials | 笔记/练习资料识别、确认与界面；LegacyNotes 兼容旧页 |
| app/src/app/api/materials、practice、notes | 页面和接口薄入口，业务规则继续放 lib |
| app/scripts/pilot*、material-worker.ts | 试点初始化、备份、状态导出与后台运行；不要放到根运维 scripts |
| docs/prd | 当前 Markdown 需求、待验证问题草稿、历史 Word 原稿；各自标明身份 |
| docs/archive/2026-10 | 日期迭代记录、旧现状、旧路线图、旧 PRD；不指导当前操作 |
| data/pilot、data/material-review | 个人试点数据与隔离测试证据；均不进入 Git |

本次实际移动了 6 份日期迭代记录到 archive；旧版 PRD、路线图、现状全文另存历史快照。当前维护入口留在 docs 顶层，避免额外增加目录层级。日期交接文档保留原路径并明确历史身份，避免既有交接链接失效。

不整理 app 为新架构，不搬动 SQLite、vault、uploads、vendor 或 tools 演示目录；运行路径、字体许可和历史数据关联不能靠文件搬家解决。未来只有模块出现明确维护问题时才重命名 pilot 或拆服务，不以目录整齐为理由批量迁移。
