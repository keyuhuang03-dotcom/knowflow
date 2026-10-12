# 知序 KnowFlow

AI 驱动的个人学习知识库：以教材为骨架，以学习记录为内容，让用户专注学习。

完整 MVP 项目仓库，包含应用、SQLite 迁移、后台 Worker、Skill、测试、设计资料及部署模板。当前支持多页拍照即保存、后台自动整理、复习卡片、多知识点关联和教材目录拍照导入。识别结果可修改，不清晰内容与未知错因不得当作确定事实。

## 快速启动

需要 Node.js 22、npm。完整 Skill 的 Word 导出额外需要 Python 3 和 `app/vendor/mistake-learning/requirements.txt` 中的依赖；基础上传与后台整理无需 Python。

```bash
cd app
cp .env.example .env  # 仅首次创建；已有配置不要覆盖
npm ci
test -e prisma/dev.db || touch prisma/dev.db  # 默认SQLite路径；自定义路径先创建父目录和空文件
npx prisma migrate deploy
npm run db:bootstrap
npm run dev -- --hostname 0.0.0.0
```

另开终端：

```bash
cd app
npm run worker
```

打开 http://localhost:3000 。手机通过同一网络中的电脑地址访问。Worker 必须独立运行，关闭浏览器不会停止已保存任务。`db:bootstrap` 只补默认用户与四个科目，不删除数据、不填充虚构教材节点；旧 `prisma/seed.ts` 是破坏性演示脚本，不用于更新。

图片 AI 配置 `.env` 的 `MISTAKE_AI_API_KEY`、`MISTAKE_AI_BASE_URL`、`MISTAKE_AI_MODEL`，需支持图片的 Chat Completions 接口；`DEEPSEEK_API_KEY` 供旧文本 AI 使用，不能代替图片配置。未配置 AI 仍可保存照片，任务会显示待配置/失败并可重试。不要提交真实 `.env`。

## 检查与协作

```bash
cd app
npm run lint
npm run typecheck
npm test
npm run build -- --webpack
```

自动化集成测试使用临时数据库、生成图片和模拟 AI，不证明真实识别准确率。CI 模板见 `docs/ci/ci.yml`；当前 GitHub 凭据缺少 workflow 权限，尚未启用自动检查。补齐权限后将模板放入 `.github/workflows/ci.yml`。iPhone Safari、真实手写和多页目录需单独验收。

| 目录 | 内容 |
| --- | --- |
| `app/src/app` | 页面、API、上传文件读取路由 |
| `app/src/components` | 业务 UI 与共享玻璃组件 |
| `app/src/lib` | AI、任务队列、图片、错题及目录服务 |
| `app/prisma` | 数据结构、历史迁移与安全初始化 |
| `app/scripts` | 独立 Worker |
| `app/vendor/mistake-learning` | 已纳入的 Skill 接口、脚本、模板 |
| `app/tests` | 单元、隔离集成和可选浏览器测试 |
| `docs` | 架构、需求、实现、验收及部署 |
| `deploy`、`compose.yaml` | Docker/Caddy 配置模板 |
| `scripts` | 数据迁移备份工具 |
| `assets`、`tools` | 设计素材和调试工具 |

## 文档入口

- [架构与数据流](docs/architecture.md)
- [开发、测试与发布流程](CONTRIBUTING.md)
- [开发说明](docs/development.md)
- [开发路线图](docs/knowflow-development-roadmap.md)
- [第一阶段实现](docs/knowflow-phase1-auto-capture.md)、[多页录入验收](docs/knowflow-multipage-upload.md)
- [教材目录识别](docs/textbook-catalog-photo.md)、[设计规范](docs/knowflow-design-system.md)
- [服务器部署步骤与已知状态](docs/aliyun-deployment.md)
- [全部资料索引](docs/README.md)

知识图谱重设计、Markdown/Obsidian 导出尚属于路线图，不能视为已实现。服务器更新仍由用户手动执行；GitHub 推送和本地构建不代表上线。仓库不包含个人数据库、照片、备份或真实服务密钥。当前是单人应用，公开多人使用前需完善身份验证与数据隔离。
