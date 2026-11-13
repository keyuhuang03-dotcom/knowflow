# Markdown 内容、图谱与恢复说明

更新：2026-11-13。本文维护当前文件格式、链接、编辑保护与恢复机制。产品流程见 [PRD](prd/PRD.md)，启动条件见 [开发说明](development.md)，笔记/练习扩展见 [资料说明](materials.md)。文件名及脚本中的 pilot 为现有技术命名，不用于划分用户功能。

## 范围与运行

入口修正：图谱嵌入“我的知识库 → 数学”的默认页面，图谱本身不新增主导航或改动其他学科页面；后续笔记/练习已调整主导航。高等数学默认图谱；线性代数、概率论继续原页面。教材与历史目录经数学页次级入口 `?view=catalog` 访问，`?catalog=1` 仍可直接录目录。旧 `/pilot` 地址只重定向到数学页。独立试验库初始化时仅补齐已有数学学科入口，不覆盖任何教材或学习记录。


- 数学一、高等数学、极限局部试点。7 个参考节点，来自本目录知识包的独立编写与公开来源核对，不沿用演示样板的 21 节点/30 关系。
- 内置结构只读。学习进度按 `local` 用户＋知识点记录，只有未学、学习中、已学。复习事件不自动改变进度。
- Reagraph 白色画布、青/蓝/紫光晕、清楚连线、相邻高亮、缩放、拖动、点选；手机有同数据列表及详情导航。
- 课堂笔记独立 MD，可以引用多个知识点；错题独立 MD，照片先保存并创建持久任务；AI 结果不覆盖个人卡点/错因。
- 旧数据库与历史内容保持原状；后续新增笔记/练习入口见 [资料说明](materials.md)。试点**从独立空库开始**，旧页面在此空库不会显示原学习数据；这不是历史数据被删除。现有生产站继续使用原数据。没有批量迁移，也没有导入个人历史记录。

在项目的 `app/` 目录运行：

```sh
npm ci
npm run pilot:init
npm run pilot:dev
```

另一终端：

```sh
npm run pilot:worker
```

入口：http://127.0.0.1:4321/knowledge → 数学 → 高等数学极限图谱（`/knowledge/math`） 。沿用本机现有 `.env` 中的登录和 AI 配置，不改写 `.env`；首次真实 AI 整理由用户上传触发，会使用配置的模型及试点额度。模型配置缺失时任务失败但材料保留，可手动重试。

持久数据固定在项目 `data/pilot/`：`pilot.db`、`vault/知识/…`、`vault/笔记/`、`vault/错题/`、`vault/附件/`。`data/` 不提交 Git。运行脚本覆盖 DATABASE_URL/UPLOAD_ROOT/Skill 数据目录到试点路径；内容服务再次核对路径，配置不一致即拒绝操作。Web 构建输出 `.next-pilot/`，生产构建 `.next-pilot-build/`，不覆盖旧 `.next/`。开发前需要 Python 3（现有项目已有 Python 工具链），文件锁使用 OS flock，因此 App 跨系统实现以后单独适配。

可用 `PILOT_DATA_ROOT=/absolute/new/path` 另建隔离试点，或 `PILOT_ORIGIN=http://127.0.0.1:4323` 指定其他本机端口；不把试点指向生产目录。`pilot:init` 幂等，但遇到已变化的内置知识文件会拒绝覆盖。

## 内容与链接格式

每份 MD 含 YAML 元信息：`id/type/title/schema_version/revision/subject/part`。现有 UUID 作为新增个人内容编号；知识包使用有命名空间的稳定编号。标题变化不改文件名。笔记文件名采用 UUID，知识文件名采用编号和固定初始标题。

```markdown
---
id: 12345678-1234-4234-9234-123456789abc
type: note
title: 极限课堂笔记
schema_version: 1
revision: 1
subject: math
part: calculus
---

[[知识/数学/高等数学/极限/KF-M1-LIM-007-等价无穷小|等价无穷小]]
[[知识/数学/高等数学/极限/KF-M1-LIM-006-无穷小量|无穷小量]]
[讲义](../附件/attachment-id.pdf)
```

编辑器搜索结果显示学科与类型，也可输入 `[[` 触发标题过滤；选择后写入实际文件路径和显示文字。裸短链接不猜测，必须消歧。反向链接来自正文与元信息的关系索引，不复制另一篇正文。章节归属、前置、相关、引用、错题确认分别索引；未确认的 AI 推荐不建立正式关联。代码片段中的双括号不作为正文引用。

这是一套使用普通文件链接的内容库，不是自定义 ID 链接协议。没有实机 Obsidian 打开验收，不声称已完成完整兼容或实时同步。首版没有任意外部移动、删除或同步接口；请勿在运行中通过外部程序修改文件。文件存在编号不匹配、重复编号、断链时重建拒绝切换。

## 正文写入、恢复与冲突

- MD 是正文来源；ContentDocument/ContentLink 是索引。MistakeItem 对试点只保留照片、任务与旧列表所需占位索引，不接受旧 API 改写试点正文。
- 全局 OS 文件锁在 Web/Worker/维护进程间共享。锁随进程/父进程死亡释放，无手工删除“过期锁”竞争。
- ContentOperation 先保存待完成操作，文件临时写入、fsync、原子替换，再事务更新索引和任务。读取试点 API、编辑、Worker 或重建会恢复待完成操作；外部变化不被自动覆盖。
- 用户保存带文档哈希和操作 UUID；重复请求收敛，过期哈希返回 409。编辑区不随轮询替换，草稿保存在本页签 sessionStorage，刷新可恢复。遇新版本先展示对照，用户明确确认后才能改用新版本校验。
- 错题保留 `question/solution/reflection/causes` 区块标识。标题、卡点改变只增加文档 revision；题干变更另增加 analysis_input_revision。移动完整区块不改变其身份。
- 后台重读最新文件，只对输入版本和目标区块均未改变的首次结果自动应用；用户改过解答、题干或标识异常，则保存 AnalysisCandidate。候选不是正式正文，接受时再次比较哈希；会替换题干/解答，并保留用户区块。
- 首版不做逐句合并。重新生成已存在的 AI 解答也保守保留候选。后台结果不修改标题、确认错因、卡点或已确认关联。
- 复用原 MistakeJob、WorkerLease、有限重试、任务恢复、识别检查点、每日额度。试点识别检查点保存在 PilotAnalysisInput，不写成用户事实。后台成功写入以租约和任务版本校验为前提。

## 状态快照与备份

`/api/pilot?state=1` 下载 JSON，`npm run pilot:state` 输出相同版本格式：

```json
{
  "format": "knowflow-learning-state",
  "schemaVersion": 1,
  "snapshotId": "UUID",
  "exportedAt": "ISO-8601",
  "userId": "local",
  "contentManifestHash": "SHA-256 of sorted [contentId, contentHash] pairs",
  "progress": [{"id":"UUID","userId":"local","contentId":"KF-M1-LIM-007","state":"learning","updatedAt":"ISO-8601"}],
  "reviewEvents": [{"id":"UUID","userId":"local","contentId":"mistake-UUID","result":"needs_review","note":"仍需检查条件","occurredAt":"ISO-8601"}]
}
```

这是导出快照，不监听、不与数据库双向编辑。首版无复习排期，旧排期没有迁移进来，不能据此声称已导出历史全部状态。`npm run pilot:import-state -- /absolute/state.json` 只向内容清单匹配、状态为空的隔离库导入；拒绝覆盖现有状态、未知内容、重复事件和非法日期。未来 App 可沿用该格式再扩展版本。

```sh
npm run pilot:backup
python3 scripts/pilot-backup.py restore /absolute/pilot-backup.tar.gz --root /absolute/new-restore-directory
```

备份命令在内容锁下恢复日志并创建 SQLite 一致性副本，包含 vault、pilot.db、候选/操作日志（在 DB 内）、可移植状态快照、可选 legacy-skill 及逐文件哈希清单。恢复目标必须不存在；拒绝危险路径、符号链接、重复条目、哈希不符和数据库完整性错误。恢复清除旧租约，对中断任务重新排队；完成任务不重跑。备份不含代码、私有配置、证书，须另保留匹配版本的程序与配置。

- 只有 MD＋附件：恢复正文、已确认关联、知识关系，重建搜索/图谱/反向链接；不恢复学习进度、逐次复习、任务、额度及候选。
- 加状态快照：额外恢复截至快照的进度和复习事件，非完整运行恢复。
- 完整备份：恢复同一快照的个人状态、运行数据、候选和内容；恢复后核查任务再启动 Worker。

恢复或回退前停止对应 Web/Worker，保留原数据目录及之后新增的内容；恢复副本验证后再决定切换，不能为了回退删除新笔记。正式切换需独立验收。

## 来源、许可与边界

知识包清单：`app/content/math1-limits/manifest.json`，各节点保存 source_ids、版本和校对状态。说明基于 OpenStax Calculus Volume 1 2.2/2.3 与 Encyclopedia of Mathematics “Asymptotic equality”，独立中文概括；关系的章节归属与学习前置是本试点的编排，不宣称来源直接给出了这些图谱边。数学一是用户已指定的目标范围，尚未逐条对照指定年份考试大纲。须补充用户教材版次、人工教学校对后再考虑正式发布。

Reagraph 4.32.0 Apache-2.0；中文图谱字体来自 @fontsource/noto-sans-sc 5.2.9，SIL OFL，许可位于 `app/public/pilot/fonts/OFL.txt`。完整简体字体约 1.5 MiB，仅进入按需加载的图谱；没有复制本机系统字体。动态个人标题没有使用仅覆盖演示节点的字体子集。

当前安装版本为 Next.js 16.4.3，公式渲染复用 KaTeX。依赖安全状态须重新审计，历史公告与版本说明不能当作当前安全结论。

## 验证方法与尚未覆盖项

- `node --import tsx --test tests/*.test.ts`：原隔离回归及新增文件层测试。
- `npm run pilot:test:browser`：临时空库＋测试登录；本机 Chrome headless，桌面和 375/390/430px；模拟后台结果，不调用真实供应商。截图和结果在不入 Git 的 `data/pilot-validation/`。
- `npm run pilot:build`：独立输出目录生产构建。
- 文件层测试覆盖多链接、只读知识、幂等保存、用户/AI 并发、并发用户保存、移动/缺失标识、崩溃恢复、索引重建、状态快照导入、Worker 失败/本机模拟供应商成功、备份与隔离恢复。

尚未验证：真实 AI 数学准确性、iPhone Safari 真机、Obsidian 实际打开、旧个人数据副本的人工访问验收、大规模节点性能及生产恢复。首版暂不提供自由改动内置结构、文件移动/删除管理、全局薄弱点分析、复杂布局持久化、多端同步或 App。

## 后续资料模块的备份边界

完整备份已包含 LearningMaterial 与 PracticeAttempt；恢复时运行中的资料任务重新排队。仅 MD/附件可恢复已确认的笔记、错题和内容关联，不能恢复原练习题集及作答历史。现有状态 JSON 仍只有知识点进度与复习事件，不包含练习作答；相关迁移应使用完整备份。

## 两种编辑草稿的区别

上述 sessionStorage 草稿保护适用于知识工作台的 MD 编辑器。笔记/练习上传后的资料校对界面目前仅在组件中保留未确认输入，刷新仍可能丢失；不要把 MD 编辑器保护扩大为全站编辑器保证。

设置页原有 `/api/backup` JSON 导入导出不是本节完整 vault 快照，不能据此推断附件及练习记录已完整备份。
