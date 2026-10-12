# 考研工作台 · Kaoyan Workbench

AI 驱动的个人考研学习工作台，包含任务管理、知识图谱、错题管理、学习记录、每日复盘、笔记和数据分析。

## 产品资料

- [资料索引](README.md)
- [Markdown 主 PRD](prd/PRD.md)：持续维护的需求文档，待决策内容以 TODO 标记。
- [Word PRD 及各版本](prd/)
- [三张原型图](prototypes/)

## 目录结构

```text
app/src/app/          页面及 API 路由
app/src/components/   业务组件
app/src/lib/          数据库、AI 及公共逻辑
app/prisma/           数据模型、迁移及初始化脚本
app/public/           应用运行时使用的静态资源和 PWA 图标
assets/           图标原稿、旧版图标和模板素材
tools/debug/      独立调试页面
docs/            PRD、原型图和资料索引
```

## 本地开发

技术栈：Next.js 16、React 19、TypeScript、Tailwind CSS 4、Prisma 6、SQLite；AI 功能使用 DeepSeek。

需要 Node.js 20.9 或更新版本。以下操作在应用目录 `app/` 中执行。现有本地环境和数据库已随应用一起移动，无需重新初始化。

```bash
cd app
cp .env.example .env
npm ci
test -e prisma/dev.db || touch prisma/dev.db
npx prisma migrate deploy
```

文本 AI 使用 `DEEPSEEK_API_KEY`；图片分析需单独配置 `MISTAKE_AI_API_KEY`、`MISTAKE_AI_BASE_URL`、`MISTAKE_AI_MODEL`。首次创建的空数据库可运行以下命令生成初始用户、科目和知识点：

```bash
npm run db:bootstrap
```

安全初始化仅补默认用户和四个科目，不覆盖已有数据。旧 `prisma/seed.ts` 会清空学习数据，不用于日常开发与更新。

```bash
npm run dev
# 另开终端，在 app/ 运行：
npm run worker
```

打开 <http://localhost:3000>。

## 常用命令

```bash
npm run lint     # 静态检查
npm run build    # 生成 Prisma 客户端并构建应用
npm start        # 运行构建后的应用
```

## 本地文件

`.env`、SQLite 数据库、用户上传内容、依赖和构建缓存均不纳入 Git。迁移脚本保留在仓库中，用于重建数据库结构。

## 从仓库根目录运行

```bash
npm --prefix app run dev
npm --prefix app run lint
npm --prefix app run build
```

部署平台的项目根目录需要设置为 `app`，再使用原有的安装、构建和启动命令。
