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

真实 .env、deploy/app.env、实际 Caddyfile、数据库与 WAL、上传和 Skill 个人记录不提交。tools/limit-graph-demo 若存在是本机专用实验，已忽略，正式接入前需替换不可分发字体并另行验收。
