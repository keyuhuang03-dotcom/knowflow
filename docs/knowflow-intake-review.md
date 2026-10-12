# 知序 KnowFlow：图片录入与可信复习（本地增量修改）

本轮只修改现有错题闭环，未推送、未部署、未操作服务器，也未运行真实数据迁移。原有未提交文件保留。无新增 npm/Python 依赖、环境变量或数据库迁移；分析 JSON 的 version 1 增加可选字段，旧文本和旧 JSON 仍可读。

## 代码与行为

- `app/src/components/wrong-questions/ImageIntake.tsx`、`app/src/lib/mistake-image.ts`：相册/拍照分开入口；本地预览、90 度旋转、四边百分比裁剪、JPEG 压缩。最长边 2400px、质量 0.9、不放大小图；输入限制 25MB/5000 万像素，上传仍为 10MB。释放对象 URL 和画布。浏览器解码器处理 EXIF，不再次手工叠加方向。实际清晰度和峰值内存需要真机检查。
- 图片只有点击上传才发送；裁剪须先“应用裁剪”。旋转/裁剪后的预览是最终上传内容，原始文件仍在用户相册。需要恢复未裁剪版本时重新选择。
- `MistakeWizard.tsx`、`mistake-draft.ts`：文字/分析/选择/稳定 UUID 改存 localStorage，兼容当前标签页旧 sessionStorage 草稿；图片 Blob 存 IndexedDB，上传失败直接重试。处理、上传、分析、保存显示状态并禁止重复操作。
- 已完成处理的图片才进入持久草稿；系统在解码途中关闭网页仍可能丢失刚选文件。未点“应用裁剪”的滑块位置不持久化。草稿仅限同一来源、同一浏览器；当前只保留一个错题草稿，请勿多标签同时编辑。清理网站数据、无痕模式、浏览器回收存储均可能使其丢失。存储失败时页面会提示，内存输入继续保留，勿刷新。
- 清空草稿先清本地待上传图片，再写入空草稿；失败时报告“清除未完成”，不删除服务器图片。上传失败可能在服务器留下孤立图片，不自动清理。保存使用原有 UUID 去重，响应丢失后重试不会重复创建错题。
- `mistake-contract.ts`、`mistake-ai.ts`、`AnalysisFields.tsx`：新增 `diagnosisStatus`、`recognition`、`uncertainty`、`nextCheck`。模型输出强制为未确认，用户单独勾选确认错因；编辑诊断或原始过程后撤销确认。没有用户过程时服务端仍强制返回“无法判断”。识别未明确可靠时不给节点推荐；用户可补拍、手动校对或补充过程。推荐继续过滤现有目录，最多三个，用户确认后保存。
- `ReviewCard.tsx`、`MistakeDetail.tsx`、`globals.css`：以卡点、特征到方法、下次检查三项组织复习，默认先想再展开；详细分析和 Skill 完整诊断折叠。旧记录默认未确认，不改变旧文本。原题、过程、来源、路径及个人补充继续可查看。
- `tests/mistake-*.test.ts` 与 `mistake-integration-run.ts`：补充草稿恢复/配额错误、裁剪尺寸边界、格式拒绝、AI 不确定性与确认持久化；集成测试上传目录也改为临时目录。

## 本地验收

这是当前下一步，尚未标记为人工验收通过。先完成下面的检查并记录失败步骤，之后再进入服务器准备阶段。域名与备案已完成的配置及待验证项见[部署状态表](aliyun-deployment.md#当前状态2026-10-08)。

在项目根目录运行 `npm --prefix app run dev`，打开 `http://localhost:3000/knowledge`。不需要覆盖 `.env`、重置数据库或运行 seed。

本地开发默认使用 webpack：2026-10-08 实际访问时，Turbopack 热更新持续报 `Next.js package not found` 并反复请求知识库页面，导致刷新抖动。此调整避开该开发工具故障，不修改业务数据或部署状态；HTTP 200 本身不能证明浏览器交互稳定。

1. 从已有节点添加错题：相册选图、旋转、裁剪、应用、核对小字后上传。补充来源及实际解题过程。
2. 在上传前刷新，确认待上传图片和文字恢复；应用裁剪后再刷新检查结果。关闭标签页后重新打开也应恢复同一草稿。
3. 用浏览器网络离线模式使上传失败，恢复网络后直接重试；原题和文字不应丢失。已选更换图片未上传时，不能分析旧图片。
4. 尝试 HEIC、PDF、超大图片，确认提示给出转 JPG/截图等操作；旧输入不被清空。
5. 无解题过程执行 AI 分析：不得出现确定个人错因。模糊图片应提示核对且不推荐节点。有过程时仍显示未确认，可编辑并单独勾选确认。
6. 选择 1～3 个现有节点，核对路径与理由后保存；从各节点回看。保存响应丢失后重试，确认只有一条错题。
7. 详情默认先思考再展开提示；查看旧记录、旧纯文本、个人补充与 Skill 诊断；编辑错因后确认标记应清除。
8. 手机 Safari 单独验证：拍照方向（横拍/竖拍）、相册选择、后台切换、内存回收、公式清晰度、裁剪触控，以及存储受限时的提示。电脑测试不能替代这些验证。

自动检查：`npm --prefix app run lint`、`npm --prefix app run typecheck`、`npm --prefix app run test`、`npm --prefix app run build`。

本轮 14 项测试、typecheck、Turbopack 与 Dockerfile 同款 webpack 构建通过；lint 有原有 notes 两处图片警告、GraphView 一处 effect 依赖警告，Turbopack 有现有文件追踪范围警告。测试使用临时数据库和模拟 AI，没有调用收费模型。浏览器 IndexedDB/画布实际运行、网络故障交互、手机 Safari、真实 AI 识别质量和服务器 Docker 构建尚未验证。

## 之后手动更新服务器

本节在本地验收通过后执行，目前不要求立即更新服务器。用户已购买并实名认证 `koayan.cn`，已在阿里云保存 `study.koayan.cn → 8.154.21.157` 的 A 记录；网站名称为「知序 KnowFlow」，ICP备案已提交审核、尚未确认通过。无需重新购买域名或重复提交备案。

以上是用户确认的配置状态，不是公网 DNS、HTTPS 或应用上线验收结果。当前没有核实 ECS Docker 安装、运行容器、DNS 实际解析、HTTPS、备案审核结果或个人数据迁移状态。本地构建通过不代表上线。进入服务器准备阶段后，先在服务器 `/opt/kaoyan-workbench` 只读检查：

```sh
cd /opt/kaoyan-workbench
docker --version
docker compose version
docker compose ps
docker compose logs --tail=80 web caddy
```

不要把日志或配置中的密钥贴入 Git。首次部署仍参考 `aliyun-deployment.md`，已有配置不要用 example 覆盖。

更新前先停止写入并备份服务器现有数据（如果已部署）：

```sh
docker compose stop web worker
mkdir -p /opt/kaoyan-backups
chmod 700 /opt/kaoyan-backups
tar -czf /opt/kaoyan-backups/before-knowflow-update.tar.gz data deploy/app.env deploy/Caddyfile
chmod 600 /opt/kaoyan-backups/before-knowflow-update.tar.gz
```

备份文件名每次使用新的名字，不覆盖旧备份；Caddy 证书卷另按原部署文档备份。若这些路径不存在，先核实部署位置，不要创建空目录冒充已备份数据。

本轮代码尚未推送，不能仅执行 git pull 就得到修改。人工检查本地差异，只传输代码与文档（含本轮新文件）到服务器临时目录，确认后合入项目目录；排除 `.env*`、`deploy/app.env`、实际 Caddyfile、`data/`、`public/uploads/`、SQLite、`.git/`、`node_modules/`、`.next/`。保留服务器自己的密钥和数据。不要将本地数据库覆盖已有线上数据。

确认代码更新后：

```sh
cd /opt/kaoyan-workbench
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 web caddy
```

现有 Dockerfile 使用 webpack 构建，启动时执行仓库已有迁移；本轮没有新增迁移。2GiB 机器构建失败时保留备份与日志，不重置数据库。人工确认域名与部署条件后，再验收 `https://study.koayan.cn` 的页面、上传、原图、AI 和保存。只有实际验收通过后才能称为上线。
