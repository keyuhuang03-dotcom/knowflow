# 考研工作台 · Kaoyan Workbench MVP

以主教材知识目录为骨架，把错题、个人理解和复习卡片关联到已有知识节点。

## 已完成的核心流程

我的知识库 → 科目知识库 → 知识节点 → 上传/拍照错题 → AI 分析与校对 → 确认 1～3 个已有节点 → 保存 → 从节点回看原题与复习卡片。

- Next.js 16 / React 19 / TypeScript / Prisma 6 / SQLite
- 桌面双栏与手机单栏布局
- 图片上传、当前标签页草稿恢复、多节点关联、保存重试去重
- AI 未配置时明确提示，支持手动整理继续保存
- 不在错题分析中自动创建知识节点

## 本地运行

需要 Node.js 20.9 或更新版本。在全新克隆的项目中：

```sh
cd app
cp .env.example .env
npm ci
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run dev
```

打开 http://localhost:3000/knowledge，在科目页核对目录并确认主教材。

**seed 会清空已有学习数据，只能用于新建的空数据库。已有环境请保留 `.env` 和数据库，不要重新 seed。**

## AI 配置

在 `app/.env` 中填写 `MISTAKE_AI_API_KEY`、`MISTAKE_AI_BASE_URL`、`MISTAKE_AI_MODEL`。服务需要支持图片输入和 JSON 输出。原有 DeepSeek 文字接口配置不能代替视觉接口。

Mistake Learning Skill 适配入口已预留，目前未直接执行 Skill。真实模型识别质量和 iPhone Safari 真机拍照需配置后进一步验收。

## 检查

```sh
cd app
npm run lint
npm run typecheck
npm run test
npm run build
```

当前版本以上检查通过；lint 保留 3 条旧代码警告，测试使用临时数据库及本地模拟视觉服务。

## 项目资料

- [MVP 实现、数据迁移与 AI 接口说明](docs/mvp-implementation.md)
- [开发说明](docs/development.md)
- [PRD](docs/prd/)
- [原型图](docs/prototypes/)

仓库不包含真实密钥、学习数据库、用户上传图片、node_modules 或构建缓存。当前为本地单用户应用，部署时需要持久化 SQLite 和上传目录。
