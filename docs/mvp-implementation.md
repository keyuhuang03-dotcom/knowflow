# 七页 MVP：运行与验收

本次以已有 Next.js 16 / Prisma 6 / SQLite 为基础，实现知识库、科目目录、节点详情、错题上传、分析校对、用户确认关联、错题详情与复习卡片。未扩展每日复盘、数据分析、番茄钟。原有相关路由保留，主导航收敛到知识库与错题闭环。

## 运行

在 `app/` 下，使用现有 `.env`，不要覆盖已有 DATABASE_URL：

```sh
npm ci
npx prisma migrate deploy
npm run dev
```

首次空数据库可按原开发文档初始化；`prisma/seed.ts` 是破坏性重置脚本，已有数据时禁止运行。本次迁移只追加可空字段、多对多关联表，并回填旧单节点关联。迁移前请备份 SQLite 和 `public/uploads`。

访问 `/knowledge` → 科目 → 核对已有目录、填写并确认主教材名称 → 节点 → 添加错题。
当前已有节点保持原样；没有伪造它们属于某本教材，也没有自动替换知识骨架。目录照片识别和完整教材管理属于后续单独链路，本次仅确认已有目录。空目录可使用保留的 `/knowledge/graph` 编辑器手动添加节点。

## 七页路由

| 页面 | 路由 |
| --- | --- |
| 我的知识库 | `/knowledge` |
| 科目知识库 | `/knowledge/[subjectId]` |
| 知识节点详情 | `/knowledge/nodes/[id]` |
| 添加错题 | `/wrong-questions/new` |
| 分析与校对 | `/wrong-questions/new/analysis` |
| 知识点确认 | `/wrong-questions/new/confirm` |
| 错题详情 | `/wrong-questions/[id]` |

## AI 配置

图片分析独立于现有 DeepSeek 文字功能。配置支持 Chat Completions 图片输入与 JSON 输出的服务：

```dotenv
MISTAKE_AI_API_KEY=""
MISTAKE_AI_BASE_URL="https://api.openai.com/v1"
MISTAKE_AI_MODEL=""
```

模型名称由实际供应商提供，不预设未经验证的型号。仅填 DEEPSEEK_API_KEY 不会启用图片分析。密钥只在服务端读取，不传给浏览器。一次请求发送原题、可选解题图片/文字、来源和本科目知识路径；45 秒超时，不自动重试。无配置返回 503，供应商失败返回 502；页面保留草稿并允许手动整理，无假分析或伪推荐。

## Mistake Learning Skill 接口

`src/lib/mistake-ai.ts` 的 `analyzeUploadedMistake` 是适配器边界；`src/lib/mistake-contract.ts` 是前后端共用契约。第一步已把 Mistake Learning Skill 的逐步诊断准则用于模型提示：先核对题目条件，再与学生过程对照，要求错因有具体步骤证据，并区分最早卡点与连带结果。缺少解题过程时，服务端强制将个人卡点和错因标为待补充。当前仍未执行本地 Skill 脚本或写其独立数据目录。

输入：`imageUrl`、`userWorkImageUrl`、`userWork`、`source`、`subject`、`textbook`、`candidates[{id,name,path}]`。

输出：

```json
{
  "analysis": {
    "version": 1,
    "question": "识别后的题目",
    "coreConcept": "核心考点",
    "stickingPoint": "卡点；无解题证据时待补充",
    "errorReason": "有依据的错因；不能猜测",
    "method": "关键公式或方法",
    "reviewTip": "下次遇到什么特征，应想到什么"
  },
  "recommendations": [{"nodeId": "已有候选ID", "reason": "推荐依据"}]
}
```

本阶段沿用现有简化输出结构，模型实际诊断质量仍取决于所配置的视觉模型，需要用真实错题人工核对。Skill 的独立 schema 与本应用不直接等价，不能原封不动写入。不得自动运行 Skill 的节点创建/掌握度变更能力。候选过滤只允许本次当前科目目录内的 ID，去重且最多三个；无法判断可返回空列表。用户勾选后，保存端再次验证科目、节点存在性和显式确认。

## 数据与恢复

- 保留 `MistakeItem.knowledgeNodeId` 作为兼容的主节点；追加 `linkedNodes` 表达 1～3 个关联。所有新页面去重计数，避免主节点重复显示。
- `aiAnalysis` 存储版本 1 JSON；旧纯文本仍可回看。新增来源、原始解题过程、过程图片、个人补充字段。
- 草稿保存在当前标签页的 sessionStorage，包含已上传图片 URL；刷新、流程返回不会清空。关闭标签页后不保证草稿保留。上传中刷新需要重新选择文件。
- UUID 在草稿建立时生成，保存重试使用相同 ID，避免响应丢失后重复插入。保存和关联在同一事务完成。
- JPG/PNG/WebP，10MB 上限，按文件签名检查；HEIC 提示转为 JPG。手机使用 `capture="environment"` 调用系统相机选择器。
- 部署必须使用持久化 SQLite 和可写的 `app/public/uploads`；提供运行时图片读取路由，支持生产构建后新上传的图片。当前仍沿用单用户本地应用假设，未新增账户登录；不要直接作为开放多人服务发布。
- 未保存的上传文件暂时保留以恢复草稿，尚未做孤立文件清理。

## 验证

```sh
npm run lint
npm run typecheck
npm run test
npm run build
```

测试使用临时 SQLite 库，不执行清库 seed、不接触真实学习数据、不调用收费 AI。覆盖迁移部署、无确认拒绝、跨科目/不存在节点拒绝、多节点落库与回查、重试去重、编辑关联、复习时间、无 AI 配置降级、非法推荐过滤、图片签名与路径限制。

人工验收：上传图片 → 尝试分析（无配置时手动整理）→ 选择两个知识点 → 确认保存 → 从两个节点回看同一条错题 → 编辑卡片与补充 → 完成本次复习；同时检查刷新草稿、切换科目、分析失败重试和窄屏无横向溢出。真实视觉模型效果与 iPhone Safari 相机需要配置服务及真机后继续验收。
