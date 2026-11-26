# KnowFlow 参赛协作

## 分支与 Issue

参赛仓库为 [knowflow](https://github.com/keyuhuang03-dotcom/knowflow)。开始前核对远端与工作区，阅读 [开发说明](docs/development.md) 和 [Agent 规则](AGENTS.md)。

- `main` 保存稳定版本，`develop/competition` 用于参赛集成。两者的变更均通过 PR，禁止直接推送、强推和删除。
- 先用 Issue 确认负责人、范围和验收条件，再从最新 `develop/competition` 创建短分支，如 `feat/android-foundation`、`feat/shared-api`、`fix/upload-retry` 或 `docs/api-contract`。Agent 可用 `codex/` 前缀。
- 日常 PR 指向 `develop/competition`，验收后的阶段版本以发布 PR 晋级 `main`。日常 PR 优先 squash，晋级 PR 使用 merge commit 保留集成历史。
- 在 PR 中用 `Refs #编号` 关联 Issue。另一位成员评审，CI 通过且讨论解决后合并；集成验收通过再关闭 Issue。超出范围先回到 Issue 对齐。

## 提交与评审

提交及日常 PR 标题用 Conventional Commits，格式为 `type(scope): summary`，scope 可省略。常用类型为 `feat`、`fix`、`docs`、`test`、`ci`、`refactor` 和 `chore`。例如 `fix(api): preserve upload retry id`。不兼容变更用 `!` 并说明迁移方式。每次提交仅覆盖一个目的。

双方先确认 API、鉴权、错误、任务状态和公共类型，再并行实现。涉及数据库时由后端负责人协调增量迁移，在新库和脱敏旧库副本验证；保留已应用迁移，禁止对已有数据执行 reset 或演示 seed。PR 写明兼容性、验证结果及未测项。

服务端检查运行迁移、lint、类型检查、测试和构建，使用隔离 SQLite、上传目录及空 AI 凭证。Android 工程入库后再加入构建检查。真实 AI、真机、Safari 与恢复演练单列。

功能更新写入对应需求与开发文档。提交前排除密钥、私有配置、数据库/WAL、照片、备份和个人 Skill 数据。发布由获授权维护者按 [运维说明](docs/aliyun-deployment.md) 单独执行。
