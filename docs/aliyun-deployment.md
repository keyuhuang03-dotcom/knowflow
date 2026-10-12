# 阿里云部署（单人使用）

本文是部署方案与待执行步骤，不是上线证明。当前优先完成[本轮本地验收](knowflow-intake-review.md#本地验收)，通过后再准备服务器更新。保留现有 Next.js、Prisma SQLite 和 Python Skill。

## 当前状态（2026-10-08）

以下“用户已完成配置”来自用户确认，本轮未登录阿里云控制台、查询公网 DNS 或连接服务器验证。

| 项目 | 用户已完成配置 / 已知状态 | 实际验证状态 |
| --- | --- | --- |
| 域名 | 已购买 `koayan.cn`，实名认证已通过 | 已记录用户确认；不需要重新购买或重复实名认证 |
| DNS | 阿里云已保存 `study.koayan.cn` 的 A 记录，指向 `8.154.21.157` | 尚未验证公网解析是否生效；保存记录不等于解析验收通过 |
| 网站名称 | 知序 KnowFlow | 已记录用户确认 |
| ICP 备案 | 已提交审核，目前尚未确认通过 | 待用户确认审核结果；不重复提交备案，不标记为已通过 |
| ECS | 阿里云杭州，Ubuntu 22.04，2 核 2GiB，40GiB；公网 IP `8.154.21.157` | 以上为用户提供背景，服务器实际安装与运行状态未核实 |
| 项目与文件 | 服务器目标目录 `/opt/kaoyan-workbench`；曾上传项目 ZIP | 尚未确认解压内容、运行版本或应用成功部署 |
| HTTPS 与数据 | 尚未确认 HTTPS 可用或本地数据完成迁移 | 待服务器阶段验收 |
| 本轮本地代码 | 上一轮本地测试、类型检查与构建通过 | 不代表手机真机验收、Docker 构建或线上服务通过；本轮没有部署 |

## 执行顺序

1. 先按本地验收清单检查图片处理、失败重试、草稿恢复、AI 不确定性、用户确认和历史复习卡片。
2. 本地验收通过后，再只读核实服务器 Docker/Compose、已有容器、配置与数据；同时核实公网 DNS 和备案审核结果。
3. 根据服务器实际状态区分首次部署或更新；已有部署先备份，再准备代码更新包，保留服务器配置和个人数据。
4. 由用户手动执行更新，随后实际检查 HTTPS、上传、AI、保存与节点回看；未验证项继续标为待验收。

域名购买、实名认证和备案提交已完成，不再列为待办。待核实的服务器条件包括 Docker Engine/Compose、安全组与防火墙、Caddy 配置和持久化数据目录。Caddy 的证书申请与续期是方案能力，不是当前 HTTPS 已可用的结论。2GiB 服务器的构建资源是否足够也需实际检查。

## 首次部署

仅在本地验收通过、确认服务器尚未部署且下列配置文件不存在时执行本节。已有 ZIP 和项目目录先核对，不重复克隆、不覆盖现有配置；已有部署使用更新流程。进入服务器项目目录 `/opt/kaoyan-workbench`，首次创建只在服务器保存的配置：

```sh
cp deploy/app.env.example deploy/app.env
cp deploy/Caddyfile.example deploy/Caddyfile
mkdir -p data/uploads data/mistake-skill
chmod 700 data
chmod 600 deploy/app.env deploy/Caddyfile
```

编辑 `deploy/Caddyfile`：把 `study.example.com` 换成 `study.koayan.cn`（公网解析仍需验证），把 `REPLACE_WITH_CADDY_BCRYPT_HASH` 换成下面命令输出的密码哈希；`learner` 可改成自己的登录名。不要把明文密码或真实配置提交到 GitHub。

```sh
docker run --rm -it caddy:2 caddy hash-password
```

如需 AI 分析，在 `deploy/app.env` 填入已有服务的密钥和模型。没有密钥时，普通错题录入、知识点关联和复习卡片仍能使用；AI 分析及完整 Skill 诊断需要对应的模型配置。然后启动：

```sh
docker compose up -d --build
docker compose logs -f web worker caddy
```

部署后验收目标为 `https://study.koayan.cn`。预期首次访问要求输入刚设定的登录名和密码；需实测 Caddy 对页面、API 和图片统一要求密码，并通过有效 HTTPS 提供服务。iPhone Safari 打开后，可从分享菜单选择“添加到主屏幕”。此模式需要网络，并非离线 App。

## 把现有电脑数据迁移到服务器

在 Mac 上，从仓库根目录运行：

```sh
python3 scripts/export-cloud-data.py /private/tmp/kaoyan-data.tar.gz
```

脚本会对 SQLite 做一致性备份，并将图片和 Skill 记录一起打包。压缩包包含个人学习资料，不要上传 GitHub。通过安全传输工具把文件复制到服务器，例如：

```sh
scp /private/tmp/kaoyan-data.tar.gz 用户名@服务器IP:/tmp/
```

在服务器仓库根目录，**首次启动前**或先执行 `docker compose stop web worker` 后导入。请确认 `data/` 中没有需要保留的新数据；解压会覆盖同名文件。

```sh
tar -tzf /tmp/kaoyan-data.tar.gz
tar -xzf /tmp/kaoyan-data.tar.gz -C data
chmod -R go-rwx data
docker compose up -d
```

迁移成功后删除 Mac 和服务器上的临时压缩包。迁移后应以服务器为唯一数据源；本机和云端同时录入不会自动同步。

## 日常维护

更新代码后运行 `docker compose up -d --build`；启动时会执行 Prisma migration。升级前先备份 `data/` 和 Caddy 证书卷。数据库运行中请使用 SQLite backup API 或短暂停止 `web` 和 `worker` 后再复制数据库文件；单纯复制运行中的 `.db` 文件可能遗漏 WAL 中的记录。图片和 Skill 数据同样需要备份。阿里云磁盘快照可作为额外恢复点，但仍应定期测试恢复。

服务器失效、停机或欠费期间手机将无法使用。基础 HTTP 密码适合当前单人 MVP；多人共享或公开发布前应增加应用内账号、权限和数据隔离。
