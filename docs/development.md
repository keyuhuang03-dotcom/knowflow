# 开发、启动与验证

先读 [功能说明](prd/PRD.md)、[架构](architecture.md) 和 `app/AGENTS.md`。修改 Next.js 代码前读取当前安装版本的相关指南。这里解释运行方式，不用 Git 分支定义产品功能。

## 1. 选择运行环境

| 目的 | Web / Worker | 数据与能力 |
| --- | --- | --- |
| 使用当前图谱、MD、笔记及练习 | `npm run pilot:dev` / `npm run pilot:worker` | 默认 data/pilot；服务会检查隔离路径 |
| 只处理笔记/练习后台 | Web 同上 / `npm run pilot:materials-worker` | 不消费原错题/目录队列，不能替代完整后台处理全部任务 |
| 维护原有功能环境 | `npm run dev` / `npm run worker` | 使用原配置；不自动启用所有新内容服务 |

所有 npm 命令在 `app/` 执行。完整功能默认地址 http://127.0.0.1:4321 ，原开发方式通常 http://localhost:3000 。端口是配置，不保证进程一直运行。

## 2. 依赖与配置

- Node.js 22、npm；按 lockfile 使用 `npm ci` 安装依赖，已有环境操作前先了解运行进程。
- Python 3 用于当前内容锁/备份及历史 Skill 工具；历史导出还需 `app/vendor/mistake-learning/requirements.txt`。
- PDF 识别需 Worker 的 PATH 中可执行 `pdfinfo`、`pdftoppm`（Poppler）；npm 安装不包含这些工具。
- 图像 AI 使用 `MISTAKE_AI_API_KEY`、`MISTAKE_AI_BASE_URL`、`MISTAKE_AI_MODEL`。文本模型配置不能替代图片能力。不要打印密钥。
- 登录、来源和签名按现有 `.env` 配置；不要覆盖旧文件。仅首次全新环境才复制 `.env.example` 并完成本地认证配置。

## 3. 当前完整功能的首次初始化

先选择一个不含正式学习数据的新绝对目录。各终端使用相同的 PILOT_DATA_ROOT、PILOT_ORIGIN；并行 Web 使用不同的 PILOT_NEXT_DIR。

```sh
# 在 app/，以下以独立测试环境为例；各终端保持相同配置
export PILOT_DATA_ROOT=/absolute/knowflow-test-data
export PILOT_ORIGIN=http://127.0.0.1:4323
export PILOT_NEXT_DIR=.next-pilot-test
npm run pilot:init
```

路径为示例，执行前换成实际新目录。`pilot:init` 会创建/迁移数据库、装入知识包并更新索引，是写入命令；不能指向生产目录。遇已变化的知识包文件会拒绝覆盖。初始化不导入旧个人学习数据。

然后分别启动 Web 与完整 Worker：

```sh
npm run pilot:dev
# 另一终端，保持相同环境变量
npm run pilot:worker
```

默认不设置上述变量时使用仓库 `data/pilot/`、4321 和 `.next-pilot`。启动脚本设置 KNOWFLOW_PILOT、DATABASE_URL、UPLOAD_ROOT 等；内容服务再次检查对应路径。

## 4. 已有环境与增量升级

已有完整环境日常使用只启动 Web/Worker，不重复初始化。升级前先按 [内容恢复说明](content-storage.md) 备份并核对迁移；必要时在副本应用增量迁移，检查正文/附件/状态/关联。`pilot:init` 不只是迁移命令，还会检查知识包；不能为绕过报错覆盖内容。

维护原方式时只在首次新库执行迁移、`npm run db:bootstrap` 与 `npm run auth:configure`；已有库不要重新 seed。普通开发数据与完整内容环境互不自动同步，旧数据未显示不等于已删除。

## 5. 检查与证据

按变更范围选择 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build -- --webpack`；完整内容构建可用 `npm run pilot:build`。图谱浏览器检查入口为 `npm run pilot:test:browser`，执行前读取脚本并确认隔离路径及浏览器依赖。

页面验收至少包含 1440/1024/390/430px，同数据/选中状态的前后截图。后台验收包含离页、失败重试、任务恢复；内容验收包含用户/AI 并发、版本冲突、反向链接及完整备份隔离恢复。

生产学习数据不用于写入测试。模拟 AI、真实样本、桌面模拟手机、Safari 真机分别记录；不能用构建通过代替视觉/模型质量验证。

## 6. 日常故障定位

| 表现 | 先核对 |
| --- | --- |
| 127.0.0.1 拒绝连接 | Web 是否运行、端口和当前日志；不是先重建数据库 |
| 页面可见但提示服务未启用 | 是否用完整功能启动脚本，数据库/附件路径是否一致 |
| 上传后一直等待 | 对应 Worker 是否运行；仅资料 Worker 不处理照片错题队列 |
| PDF 识别失败 | Poppler PATH、页数/体积、任务错误；保留原文件再重试 |
| 笔记看不到历史内容 | 当前数据目录与旧笔记入口；不要直接覆盖/搬库 |

## 7. 协作与发布

工作前检查已有改动，保留他人工作；不使用 reset/clean、清库 seed 或无差别 add。具体规则见 [协作规范](../CONTRIBUTING.md)。本轮文档更新不涉及提交或发布。

现有生产操作模板见 [部署说明](aliyun-deployment.md)，上线新内容能力前另核对启用配置、PDF 依赖、备份和恢复。工具样板、可分发资源与正式 app 代码分别维护；不要直接发布含本机字体的演示目录。

## 文档维护与不可回退检查

功能规则只维护在 PRD；已知缺口及待办顺序维护在 current-status；模块/数据职责维护在 architecture；运行步骤分别维护在本页、content-storage 和 aliyun-deployment。README 只保留概览与入口，避免每次迭代新增一份同内容说明。用户研究草稿、历史 Word 和原型不等于已确认需求，不因维护 Markdown 而覆盖原稿。

个人数据和验收截图放 data；真实 .env、deploy/app.env、实际 Caddyfile、数据库/WAL、附件和 Skill 个人记录不入 Git。独立图谱样板含本机字体时不能直接发布，app 使用的分发字体另查许可。

回归需保留既有交互与可靠性：

- 错题和教材目录都支持多页；裁剪直接拖四边/四角，未应用裁剪先应用或重置再切页，不退回百分比滑条。
- 标题、选项、摘要、提示与解答均检查公式渲染；不能只验证正文。
- 保存补充、保存错因及完成复习都保留当前个人内容；并发 AI 完成、失败重试、刷新及切换视图均验证，不整体覆盖 selfReport。
- 教材后台按页保留检查点；ready 与确认保存分离，书名/页码/层级明确反馈；替换目录不删除旧错题、笔记或关联。
- 手机导航只有当前项高亮；错题筛选、题数、底部遮挡及桌面布局作对照，不以手机优化破坏桌面。
- 保护用户与其他会话修改；已授权工作继续完成，缺失信息只问具体问题。实际截图、代码实现、模型实测与上线状态分别报告。

上述是回归要求，不能视为本轮已执行。资料 PDF 当前最多 12 页，体积/页数/模型时限也有限制；出错保留原件，按任务错误决定拆分或重试。不要只凭上传成功就告诉用户所有编辑已保存。
