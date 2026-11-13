# 阿里云运行、发布与备份

以下环境与上线情况来自已有运维记录，本轮未重新连接生产核验；不要按旧“首次部署”说明重建目录或覆盖配置。现状见 [项目现状](current-status.md)，核心功能见 [功能说明](prd/PRD.md)。

## 环境与边界

- 正式地址：https://www.koayan.cn；服务器 8.154.21.157；部署目录 `/opt/kaoyan-workbench`。
- Ubuntu 22.04，2 vCPU / 2GiB 档；Mac 已具备 Colima/Docker 构建环境。
- Compose 的 web/worker 共用 `knowflow-web:local`，Caddy 提供 HTTPS。3000 不映射到公网，外部端口为 80/443。
- 持久目录 `/opt/kaoyan-workbench/data` 挂载到 `/data`：SQLite、uploads、mistake-skill、backups。
- `deploy/app.env`、`deploy/Caddyfile` 属于服务器私有配置，不能随代码包覆盖。
- 当前登录由应用保护页面/API/照片/导出，不是只依赖 Caddy Basic Auth。
- 模板请求体上限：上传 26MiB、JSON 1MiB、登录 4KiB；应用还在解析前校验，有限流、并发及超时保护。

## 只读预检

使用已授权的 SSH 和已核验主机指纹连接，不把密码、API 密钥、私钥写进文档或日志。进入服务器后可读取：

```sh
cd /opt/kaoyan-workbench
cat /opt/knowflow-releases/current
docker compose ps
df -h /
systemctl status knowflow-backup.timer --no-pager
```

本机 origin 是 MVP 私有仓库；先在本机检查远程、分支和工作区，不再依赖已失效的临时工作树。生产是正式学习数据源，本地数据库不会自动同步过去。

## 更新流程

1. 在隔离数据中完成适用检查。只改文档/Git 配置时不需要重建或上线。
2. 用 Mac 的 `knowflow` Colima profile、`colima-knowflow` Docker context 构建 **linux/amd64** 镜像。不要在小内存服务器上执行完整 Next.js 构建；也不要部署 ARM 镜像。
3. 排除真实环境变量、数据库、照片、备份、node_modules、.next 和个人 Skill 文件，打包本次代码；导出镜像并生成 SHA-256 校验。
4. 上传到独立 `/opt/knowflow-releases/<版本>/`，校验完成后再切换。
5. 持有维护锁；保留旧镜像、代码和私有配置回滚包，先做一致性数据快照。
6. 运行已审查的版本发布脚本，启动 web/worker，等待实际任务结束，不把 activating 或仅 Result=success 当作已完成。
7. 检查容器、数据库完整性/外键/记录、登录和本次关键业务；生产浏览器验证默认只读。
8. 下载快照到 Mac，等待传输结束后验证；停止不再使用的构建虚拟机。

历次发布脚本与证据在本机 `data/deployment/`。其中 hash、镜像标签、备份路径和预期旧版本是每次专用的，不能把旧脚本原样套用。线上当前版本标记在 `/opt/knowflow-releases/current`，代码配置回滚归档位于 `/opt/knowflow-release-backups`。

Docker 基础镜像使用 ECR 官方镜像路径，原因是服务器此前访问 Docker Hub 超时。构建网络代理地址是本机环境参数，不是项目永久常量。此流程已由获授权维护者从 Mac 执行，不再要求用户手工上传每次更新。

## 登录与 AI 配置

正式来源为 `APP_ORIGIN=https://www.koayan.cn`；本地开发来源单独配置。使用 localhost、127.0.0.1 或局域网地址时，不要混用可信来源。配置变更后按需要重新登录。

图片 AI 使用 `MISTAKE_AI_API_KEY`、`MISTAKE_AI_BASE_URL`、`MISTAKE_AI_MODEL`，必须具有图片能力；旧文本配置不能替代。修改 app.env 后需重建相应容器以读取配置；不要输出配置值。AI 额度是调用次数机制，不等于金额限额。

## 备份

- 历史配置为每日北京时间 04:00 自动备份；执行前核对定时器和实际运行结果，不把历史 enabled / active 当成当前证据。
- 自动策略至少保留最新 14 个自动快照，且只删除超过 14 天的更旧 auto-snapshot；不删除人工/发布快照。
- 用户选择暂不配置自动异地传输，先下载到这台 Mac。
- 备份包括数据库、照片和 Skill 文件；配置、代码及 Caddy 证书卷的恢复范围另行确认。
- 手动备份使用 `scripts/server-backup.sh`，它会短暂停写以保证一致性，并校验归档和数据库。

下载工具：

```sh
sh scripts/download-server-backup.sh 用户名@8.154.21.157 /opt/kaoyan-workbench/data/backups/实际文件名.tar.gz 本机私有备份目录
```

必须等待下载命令成功退出，再运行 `python3 scripts/verify-backup.py 实际文件路径`。不要校验正在传输的压缩包。私有备份只给本人访问，不提交 Git。

## 恢复与回滚

恢复工具为 `scripts/server-restore.sh`，需明确恢复目标与确认参数；先在隔离环境演练，不直接覆盖生产。工具的暂存、迁移和旧目录保留流程不能绕过。禁止 migrate reset、db push --force-reset、演示 seed、直接删除学习数据库。

代码回滚还需确认与现有数据库兼容，保留当前数据快照后切换旧镜像；备份存在不等于灾备恢复已验收。生产全量恢复演练、Safari 真机与真实模型质量仍在待验收范围。

## 交接中保留的操作要点

既有部署记录中的正式数据库为 `data/kaoyan.db`，照片为 `data/uploads`，Skill 为 `data/mistake-skill`，快照为 `data/backups`；与新内容 vault 的备份路径不能混用。发布前读实际配置核对。SSH 使用现有 agent、凭据和已核验主机指纹，不因交接要求重新创建云 AccessKey；不输出凭据。

历史验收与发布证据保留在本机私有 `data/deployment/`、`data/mobile-experience-20261026/`；历史 Git 对齐备份在 `data/backups/git-alignment-20261027/`。这些是查证位置，不证明今日生产健康或测试通过。先完成传输再校验压缩包，避免将半包 EOF 误判为备份损坏。
