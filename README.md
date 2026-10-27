# 知序 KnowFlow

用于个人考研学习的知识工作台：以教材为骨架，将错题、笔记和复习记录关联到知识点。

**网站已上线：[www.koayan.cn](https://www.koayan.cn)。** 手机侧重拍照录入与查看后台整理状态，桌面保留教材管理、图谱、学习记录与分析。当前是单人 MVP，不是多租户应用。

## 先看这些文档

- [项目现状与版本边界](docs/current-status.md)：线上、GitHub、本地三个状态的唯一现状入口。
- [功能说明](docs/features.md)：当前可用流程与限制。
- [开发与检查](docs/development.md)、[协作流程](CONTRIBUTING.md)。
- [部署、备份与回滚](docs/aliyun-deployment.md)、[架构](docs/architecture.md)。
- [完整交接文档](docs/KnowFlow-项目交接文档-2026-10-27.md)、[全部文档索引](docs/README.md)。

旧版“仅本地”“未部署”“备案待确认”等过程记录已移至 [历史归档](docs/archive/README.md)，不要按旧记录初始化正在运行的服务器。

## 本地启动

需要 Node.js 22、npm。已有环境文件和个人数据库不要覆盖；下面只在**首次新建开发环境**时复制配置：

```sh
cd app
test -f .env || cp .env.example .env
npm ci
test -e prisma/dev.db || touch prisma/dev.db
npx prisma migrate deploy
npm run db:bootstrap
npm run auth:configure
npm run dev
```

另开终端，在 `app/` 运行 `npm run worker`。访问 http://localhost:3000 。来源、密码和签名密钥按本地环境配置；手机通过局域网地址访问时也要核对可信来源。安全初始化只补用户和四个科目，不填虚构教材节点；旧演示 seed 不用于已有数据更新。

图片 AI 配置为 `MISTAKE_AI_API_KEY`、`MISTAKE_AI_BASE_URL`、`MISTAKE_AI_MODEL`，需要图片输入能力。旧文本配置 `DEEPSEEK_API_KEY` 不能替代图片模型。AI 未配置或失败时照片仍保留。真实密钥、数据库、照片、备份和个人 Skill 记录不提交 Git。

## 检查

在 `app/` 执行：

```sh
npm run lint
npm run typecheck
npm test
npm run build -- --webpack
```

自动化测试使用隔离数据库和模拟 AI，不能证明真实模型准确率或 iPhone Safari 真机体验。最近完整回归为 40 项通过，具体范围见现状文档；CI 模板位于 `docs/ci/ci.yml`，自动运行是否已启用需单独核对。

## 仓库与发布

唯一目标仓库是私有仓库 [keyuhuang03-dotcom/kaoyan-workbench-mvp](https://github.com/keyuhuang03-dotcom/kaoyan-workbench-mvp)。本机 origin 已对齐到它，旧仓库以 `legacy` 保留且禁用推送。推送代码不等于上线；文档提交可以领先线上运行版本。

生产更新采用 Mac 构建 linux/amd64 镜像、校验传输、服务器备份、切换和验收。无需用户再手动上传每次更新，也不要在 2GiB 服务器上完整构建。图谱重设计、Markdown/Obsidian 双向同步和公开多人使用仍不是已完成功能。
