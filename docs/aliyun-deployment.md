# 阿里云部署（单人使用）

现有工作台仍在本机运行。以下部署会让服务器独立运行网页、数据库、图片和错题 Skill；Mac 关机后，iPhone 仍可通过网络访问。此方案保留现有 Next.js、Prisma SQLite 和 Python Skill，不改动数据模型。

## 需要准备

- 一台可运行 Docker Compose 的阿里云 Linux 服务器。先试用可选香港地域；如果使用中国内地服务器，请先确认域名备案要求。
- 一个指向服务器公网 IP 的域名。Caddy 会为该域名申请并更新 HTTPS 证书；服务器安全组/防火墙需开放 TCP 80、443。不要对公网开放 3000。
- Docker Engine 和 Compose 插件。服务器内存建议至少 2 GB；构建期间可能需要更多，低配置机器可先在本地或 CI 构建镜像。

## 首次部署

在服务器上克隆私有仓库，进入仓库根目录。先创建只在服务器保存的配置：

```sh
cp deploy/app.env.example deploy/app.env
cp deploy/Caddyfile.example deploy/Caddyfile
mkdir -p data/uploads data/mistake-skill
chmod 700 data
chmod 600 deploy/app.env deploy/Caddyfile
```

编辑 `deploy/Caddyfile`：把 `study.example.com` 换成已解析的域名，把 `REPLACE_WITH_CADDY_BCRYPT_HASH` 换成下面命令输出的密码哈希；`learner` 可改成自己的登录名。不要把明文密码或真实配置提交到 GitHub。

```sh
docker run --rm -it caddy:2 caddy hash-password
```

如需 AI 分析，在 `deploy/app.env` 填入已有服务的密钥和模型。没有密钥时，普通错题录入、知识点关联和复习卡片仍能使用；AI 分析及完整 Skill 诊断需要对应的模型配置。然后启动：

```sh
docker compose up -d --build
docker compose logs -f web caddy
```

浏览器打开自己的 `https://域名`。首次访问会要求输入刚设定的登录名和密码。Caddy 对页面、API 和图片统一要求密码，且只通过 HTTPS 对外提供。iPhone Safari 打开后，可从分享菜单选择“添加到主屏幕”。此模式需要网络，并非离线 App。

## 把现有电脑数据迁移到服务器

在 Mac 上，从仓库根目录运行：

```sh
python3 scripts/export-cloud-data.py /private/tmp/kaoyan-data.tar.gz
```

脚本会对 SQLite 做一致性备份，并将图片和 Skill 记录一起打包。压缩包包含个人学习资料，不要上传 GitHub。通过安全传输工具把文件复制到服务器，例如：

```sh
scp /private/tmp/kaoyan-data.tar.gz 用户名@服务器IP:/tmp/
```

在服务器仓库根目录，**首次启动前**或先执行 `docker compose stop web` 后导入。请确认 `data/` 中没有需要保留的新数据；解压会覆盖同名文件。

```sh
tar -tzf /tmp/kaoyan-data.tar.gz
tar -xzf /tmp/kaoyan-data.tar.gz -C data
chmod -R go-rwx data
docker compose up -d
```

迁移成功后删除 Mac 和服务器上的临时压缩包。迁移后应以服务器为唯一数据源；本机和云端同时录入不会自动同步。

## 日常维护

更新代码后运行 `docker compose up -d --build`；启动时会执行 Prisma migration。升级前先备份 `data/` 和 Caddy 证书卷。数据库运行中请使用 SQLite backup API 或短暂停止 `web` 后再复制数据库文件；单纯复制运行中的 `.db` 文件可能遗漏 WAL 中的记录。图片和 Skill 数据同样需要备份。阿里云磁盘快照可作为额外恢复点，但仍应定期测试恢复。

服务器失效、停机或欠费期间手机将无法使用。基础 HTTP 密码适合当前单人 MVP；多人共享或公开发布前应增加应用内账号、权限和数据隔离。
