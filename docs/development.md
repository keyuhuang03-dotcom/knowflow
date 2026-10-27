# 本地开发与验证

先读 [项目现状](current-status.md)、[功能说明](features.md)、[架构](architecture.md) 和 `app/AGENTS.md`。修改 Next.js 代码前按 AGENTS 读取当前安装版本的相关指南。

## Git 基线

唯一目标仓库为私有 MVP。origin 已指向 `keyuhuang03-dotcom/kaoyan-workbench-mvp`，main 跟踪 origin/main。旧仓库以 legacy 保留且禁止推送；过去临时同步工作树的失效登记已清理。

```sh
git status --short
git remote -v
git branch -vv
```

工作区有别人修改时先检查，不直接 reset/clean 或覆盖。新功能使用 codex/ 前缀分支，避免改错仓库。代码、GitHub 和服务器版本分别核对；仅文档提交领先线上并不代表漏部署。

## 环境

Node.js 22、npm。Python 3 及 `app/vendor/mistake-learning/requirements.txt` 供历史 Skill 文档功能使用。构建/部署另需现有 Colima/Docker；普通本地 Web 开发不要求启动 Docker。

首次新建开发环境：

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

已有 .env、数据库或自定义路径时不要覆盖/重建。安全 bootstrap 仅补默认用户和四科；旧演示 seed 会清数据，不用于更新。另开终端在 app/ 执行 `npm run worker`。

访问 http://localhost:3000；可信来源、账号和会话配置按本地环境设置。局域网手机地址和正式 APP_ORIGIN 不混用。本地与云端数据库不是实时同步关系，生产是正式学习数据源。

文本 AI 配置与图片模型分开，图片使用 MISTAKE_AI_* 三项。不要打印密钥，不把真实环境文件、上传或 Skill 个人记录纳入 Git。

## 检查

在 app/ 执行 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build -- --webpack`，按修改风险选择适用检查。浏览器写测试只能用显式隔离数据库和上传目录；现有 app/tests 脚本提供案例，不能对生产写样本。

手机布局检查 375/390/430px，并对照桌面；目录、图片、保存与后台任务变更检查刷新/离页/失败/重试和历史数据。真实模型、Safari 真机、生产恢复分别记录，不能用模拟成功代替。

## 本地实验

`tools/limit-graph-demo/` 若存在，是不连接 KnowFlow 数据的本机图谱比较样板，含本机专用字体，已忽略，不随正式仓库和镜像发布。它的演示关系和进度不代表正式功能或用户学习数据。需要正式接入时另做授权资产替换和业务验收。

发布流程见 [部署文档](aliyun-deployment.md)；不能在 2GiB 服务器上重新构建完整应用。
