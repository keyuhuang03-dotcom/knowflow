# 阿里云部署（单人使用）

本文是部署方案与待执行步骤，不是上线证明。当前优先完成[上线前本地验收](release-readiness.md)，通过后再准备服务器更新。保留现有 Next.js、Prisma SQLite 和 Python Skill。

## 2026-10-18 部署进展（用户提供终端输出）

- 用户确认备案已通过：浙ICP备2026086038号-1；实际入口选定 `https://www.koayan.cn`。
- 服务器查询 `www.koayan.cn` 返回 `8.154.21.157`；这是服务器解析结果，不是HTTPS验收。
- Ubuntu 22.04.5，Docker 29.8.2、Compose v5.6.0；没有容器或80/443/3000监听。约32GB空余磁盘、1.1GiB可用内存、2GiB Swap。
- 旧目录已由用户保留至 `/opt/kaoyan-workbench-before-deploy-20261018-230257`；新的 `/opt/kaoyan-workbench` 为空目录。旧配置保留，不删除。
- 正在准备上传当前本地代码和个人数据，尚未启动网站或验证HTTPS。

## 历史状态（2026-10-13，以上方最新记录为准）

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
sudo chown -R 1000:1000 data
chmod 700 data
chmod 600 deploy/app.env deploy/Caddyfile
```

编辑 `deploy/Caddyfile`：确认域名为 `www.koayan.cn`。新模板由应用登录保护页面、API、图片和导出，并分别限制上传、登录和普通请求体。已有Caddy配置不要直接覆盖，先备份并核对后再替换相应配置。

在本地 `app/` 目录运行以下交互命令，为仅留在本地/服务器的部署配置设置单人账号、密码哈希和会话密钥，来源填写 `https://www.koayan.cn`；密码不回显，不保存在命令历史。配置文件包含密钥，禁止提交GitHub，安全传输至服务器后设为600权限。实际安装位置或工具未确认，不应假设服务器能直接运行此命令。

```sh
npm run auth:configure -- ../deploy/app.env
```

应用必须配置 `AUTH_USERNAME`、`AUTH_PASSWORD_HASH`、`AUTH_SECRET`、`APP_ORIGIN`；缺失会拒绝访问。公开生产来源必须HTTPS。修改密码或密钥后重启Web，旧会话失效。已有Caddy Basic Auth可继续作为外层保护，但会先出现浏览器密码弹窗，再进入网页登录；取消外层保护前必须验证应用鉴权正常。

如需 AI 分析，在 `deploy/app.env` 填入已有服务的密钥和模型。没有密钥时，普通错题录入、知识点关联和复习卡片仍能使用；AI 分析及完整 Skill 诊断需要对应的模型配置。然后启动：

```sh
docker compose up -d --build
docker compose logs -f web worker caddy
```

部署后验收目标为 `https://www.koayan.cn`。预期首次访问跳转到知序登录页；未登录的API、图片和导出均应返回401。需通过有效HTTPS提供服务。Compose没有发布3000端口，安全组和防火墙仍需实测公网3000不可达。iPhone Safari 打开后，可从分享菜单选择“添加到主屏幕”。此模式需要网络，并非离线 App。

## 把现有电脑数据迁移到服务器

在 Mac 上，从仓库根目录运行：

```sh
python3 scripts/export-cloud-data.py /private/tmp/kaoyan-data.tar.gz
```

脚本会对 SQLite 做一致性备份，并将图片和 Skill 记录一起打包。压缩包包含个人学习资料，不要上传 GitHub。通过安全传输工具把文件复制到服务器，例如：

```sh
scp /private/tmp/kaoyan-data.tar.gz 用户名@服务器IP:/tmp/
```

在服务器首次启动前，先校验并解压到独立空目录，不直接覆盖现有数据：

```sh
python3 scripts/verify-backup.py /tmp/kaoyan-data.tar.gz --extract /opt/kaoyan-workbench/.initial-data
```

仅当 `data/` 确认没有已有学习数据时，将空目录另名保留，再把 `.initial-data` 改名为 `data`，执行 `sudo chown -R 1000:1000 data`。已有数据使用下方离线恢复工具，不能直接解压覆盖。迁移后以服务器为唯一数据源；本机和云端同时录入不会自动同步。保留校验通过的 Mac 备份，不把个人资料上传 GitHub。

## 更新与备份（用户手动执行）

首次先只读预检：`sh scripts/server-preflight.sh`。新镜像构建、Caddy 语法和容器健康状态需在具备 Docker 的机器实际验证；本机未安装 Docker，不能声称已通过。2GiB ECS 优先在有足够内存的 Linux amd64 构建机生成镜像，安全传输后 `docker load`，减少服务器构建压力。不要使用 ARM 镜像部署 x86 服务器。

已有部署更新顺序：

```sh
cd /opt/kaoyan-workbench
sh scripts/server-backup.sh
# 保留旧镜像，部署此前验收的新代码；不覆盖 deploy/app.env、deploy/Caddyfile、data/
docker compose build web
docker compose up -d
sh scripts/server-preflight.sh
docker compose ps
docker compose logs --tail 100 web worker caddy
```

备份脚本暂停原先运行的 Web/Worker，生成数据库、照片和 Skill 的完整快照及 SHA-256 清单，校验后恢复原容器；有磁盘空间检查和维护互斥锁，不自动删除旧备份。Caddy 的证书卷与服务器私有配置需另行安全备份。健康检查不等于用户业务验收，容器 unhealthy 也不会自动修复，需查看日志。

生产配置 `APP_ORIGIN=https://www.koayan.cn`；本地继续用 `http://localhost:3000`。`AUTH_TRUST_PROXY_IP=true` 只能在公网不能直连3000、Caddy覆盖客户端IP头时启用。`AI_DAILY_LIMIT=100` 是每日整理操作次数上限，包含失败尝试，不是金额上限；两阶段整理可能包含多次模型调用。`ALLOW_WEB_RESTORE=false` 保持默认，线上使用离线恢复。更新登录配置或来源后需重新登录。

### 下载到这台 Mac

用户选择暂不配置异地自动传输。服务器备份完成后，记下工具输出的**真实文件名**，在 Mac 仓库根目录执行：

```sh
sh scripts/download-server-backup.sh 用户名@8.154.21.157 /opt/kaoyan-workbench/data/backups/snapshot-实际文件名.tar.gz "$HOME/KnowFlow-private-backups"
```

工具下载快照与校验文件，校验成功才放入目标目录；拒绝覆盖同名备份。需要你已有的 SSH 凭据，没有在本轮连接服务器或下载服务器数据。备份含个人资料，目标目录只给本人访问，不提交Git。自动服务器本地备份的 systemd 模板在 `deploy/systemd/`，尚未安装启用；按需手动启用，保留磁盘空间监控与人工清理。

### 离线恢复与回滚

仅在需要恢复并已确认备份目标时，由用户在服务器执行：

```sh
sudo sh scripts/server-restore.sh /绝对路径/已校验快照.tar.gz --confirm-replace
```

工具先在停写状态备份当前完整数据，验证并解压目标到暂存目录，先运行迁移、保留较高的已有每日AI用量，再切换目录。旧完整目录保留为 `data-before-restore-*`，不删除照片/记录。恢复后核对历史错题、多页原图、知识关联、队列状态和登录。备份可还原数据，但代码回滚仍要切换与数据库兼容的旧镜像；不使用 `migrate reset`、`db push --force-reset` 或删除数据库。

## 服务器最终验收

用户购买域名、实名认证和提交备案已完成；备案审核结果仍待确认，不重复提交。还需实际核验公网 DNS、HTTPS证书、未登录页面/API/照片/导出保护、公网3000不可达、手机多页上传及离页后后台整理、AI故障照片保留、重启恢复、备份下载与一次恢复演练。上述服务器项本轮未验证，不能把本地构建成功描述为上线成功。

## 首次构建下载问题（2026-10-18）

用户服务器连接 Docker Hub 超时，但 npm 可达。用户已成功拉取 `public.ecr.aws/docker/library/node:22-bookworm-slim`，返回摘要 `sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392`。当前 Dockerfile 两阶段均使用该 ECR 官方镜像地址，Compose 的 Caddy 同步使用 `public.ecr.aws/docker/library/caddy:2`。Caddy下载、完整镜像构建及启动仍待用户执行验证。先前已上传的代码压缩包不含本次地址修正，需要同步修改服务器文件；不涉及数据库或密钥。
