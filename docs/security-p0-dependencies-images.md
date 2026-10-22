# 上线加固：依赖与远程图片（2026-10-12）

本轮只修改依赖清单、锁文件与Next图片配置，不修改数据结构、数据库、AI提供方或业务功能，保留已有未提交修改。未推送GitHub、未部署服务器。

## 已落实

- Next.js：16.2.12 → 16.4.0，匹配升级 eslint-config-next。
- sharp：0.34.5 → 0.35.5。
- 使用不带force的npm audit fix应用兼容传递依赖修复。
- next.config.ts 的 images.remotePatterns 改为空数组，不再接受任意远程HTTPS来源。项目没有next/image远程图业务需求，本地照片与静态插画继续使用原有路径。
- Node版本要求仍为20.9或以上，Docker继续使用Node22。

## 审计边界

升级前15项（14高危、1严重），升级后8项高危、无严重。Next.js与sharp不再被此次npm审计列为受影响依赖，不能由此宣称项目没有其他安全风险。

剩余告警有两条依赖链：

1. eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces：深度嵌套模式导致栈耗尽。属于开发检查工具链，不能把未经信任的项目或匹配模式交给它运行。
2. prisma → @prisma/config → deepmerge-ts：递归对象合并导致栈耗尽。Prisma CLI在构建和生产迁移时使用，不能笼统称作只存在于开发环境；未发现本项目将HTTP输入传入这段配置处理。

审计建议的force修复会降级eslint-config-next和Prisma。本轮未采用，未以不兼容跨主版本override隐藏告警。第一项依赖风险修补已推进，但尚未全部清零；后续应核对上游修复、评估兼容版本，再做隔离迁移与配置回归。第二项任意远程图片来源已关闭。

## 实际验证

- 23项单元/隔离集成测试通过。
- 类型检查、生产webpack构建通过，构建配置使用临时数据库路径，不操作个人数据库。
- lint无错误，3项已有警告保留。
- sharp新版本生成PNG、解码及90度旋转验证通过。
- 临时生产服务实测：外部HTTPS图片与回环HTTPS图片优化请求均返回400；本地学科SVG返回200。测试服务已停止。
- 未验证真实iPhone Safari、真实AI图像识别和完整Docker镜像。

后续服务器更新须安装此次锁文件或重新构建镜像，只更新package.json而不更新依赖不会生效；继续按部署文档备份、迁移和启动单Worker。本轮没有执行服务器更新。
