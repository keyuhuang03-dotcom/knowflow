# KnowFlow Liquid Glass 视觉实验

入口：本地开发服务运行时访问 `http://127.0.0.1:3000/design-lab`。

本轮新增独立页面与组件，沿用现有外层导航；不修改业务页面、全局样式、数据库、API 或依赖。所有学科数据都是固定展示样例，卡片不写入数据。未部署或推送。没有收到最终参考效果图，本实现依据文字简报，不声称与参考图逐像素一致。

## 视觉规范候选

- 底色 `#FAFAF7`；青柠环境光 `#DDE8B8`、奶油环境光 `#F5EDCC`，以低透明度大面积柔和渐变呈现。
- 正文墨绿 `#2E4138`、辅助文字 `#617063`、分隔线 `#E2E7DA`。
- 展示文字 Avenir Next / PingFang SC，正文系统字体，参数等宽字体；无远程字体请求。
- 圆角 26px，1px 玻璃边缘，默认透明度 78%、模糊 16px、高光 70%、折射 scale 3、阴影强度 24%。
- 没有连续动画、噪声纹理、彩色光带、波浪或图像背景。可选“通透观察标记”只用于比较实际背景透过与折射，默认关闭，不是设计装饰。

| 方案 | 视觉差异 | 相对开销与适用范围 |
| --- | --- | --- |
| A 基础毛玻璃 | 均匀半透明底色，背景模糊，普通边界和阴影 | 单层 backdrop blur，作为基准；大面积模糊仍有成本 |
| B 精致玻璃 | 透明度渐变、顶部/侧面高光、内侧细边和柔和接触阴影 | 同样一层 blur，增加静态 CSS 渐变与阴影；推荐用于后续日常学习卡片 |
| C Liquid Glass | B 加静态双通道位移图，仅改变背后像素，中心近乎不位移，边缘轻微偏折 | 增加 SVG 图像采样、混合、位移处理；只在桌面 Chromium 保守启用，建议少量使用 |

这些是实现层面的开销比较，不是实际设备 FPS 或耗电测量。默认柔光背景上 B/C 差异故意很轻；观察折射时可以打开标记、暂时降低模糊、提高折射，然后恢复默认。

## 使用实验页面

1. 在同一背景、同一参数下比较三张相同数学卡片。
2. 切换晨间柔光、青柠微光、奶油日光、纯净奶白。纯色背景缺少可折射信息，玻璃边缘应仍可辨认。
3. 调节五个滑块，数值实时显示；折射只影响处于高级模式的 C。恢复默认只重置材质参数。
4. 选择 A/B/C 后复制 CSS 参数。复制权限不可用时会选中文本，支持手动复制。
5. C 的兼容模式可以手动开启。移动端或不在保守启用范围的浏览器中，C 使用 B，页面说明当前模式。

## 可复用组件

文件：

- `app/src/app/design-lab/page.tsx`：实验路由和标题。
- `app/src/components/design-lab/DesignLab.tsx`、`DesignLab.module.css`：对比界面与作用域样式。
- `app/src/components/design-lab/GlassCard.tsx`、`GlassCard.module.css`：材质、独立文字层、SVG 位移与降级。
- `app/src/components/design-lab/glass.ts`：默认参数、滑块约束、CSS 导出。
- `app/tests/design-lab.browser.mjs`：可选无界面浏览器回归脚本，不进入现有 Node 单元测试命令。

```tsx
import GlassCard from "@/components/design-lab/GlassCard";

<GlassCard
  variant="B"
  settings={{ transparency: 78, blur: 16, highlight: 70, refraction: 3, shadow: 24 }}
>
  {/* 业务内容将来再按用户确认的方案接入 */}
</GlassCard>
```

透明度定义为白色底层透过比例：`--glass-tint = 1 - transparency / 100`。B/C 在此基础上有额外的透明渐变，控件不是对整个元素设置 opacity，因此不会淡化文字。折射数值是 SVG displacement scale（名义像素），单通道实际偏移约为 ±scale/2。

导出的 `.knowflow-glass` CSS 可用于没有传入 `settings` 的组件；传入 `settings` 时，内联参数优先。C 的 SVG `scale` 通过 `settings.refraction` 设置，不能只粘贴 CSS 就获得折射；导出注释同时保留 settings JSON 和组件用法。实例 SVG ID 使用 React useId，多个卡片不互相引用。

## 兼容与降级

- 使用标准与 `-webkit-backdrop-filter` 双声明。
- `CSS.supports` 只说明语法接受，不足以证明 SVG 背景滤镜能正确渲染。因此高级模式额外限定桌面 Chromium；Safari/其他引擎、触控设备保守回退 B。
- 没有 backdrop-filter 时使用浅色实底，保留结构和清晰文字。
- `prefers-reduced-transparency` 或 `prefers-contrast: more` 时取消模糊/折射并提高边界对比。
- 页面没有循环动画；不依赖鼠标悬停，滑块可键盘调节，移动端单列，无固定高度裁切正文。

实现依据：[MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)、[MDN SVG 滤镜兼容性讨论](https://github.com/mdn/browser-compat-data/issues/24110)。本轮没有复制或引入 `Meapri/liquid-glass-web` 代码，SVG 位移图为项目内原创实现，无该仓库许可证依赖。

## 验证与待验收

已执行 lint、typecheck、webpack 生产构建。lint 仅保留业务代码原有三条警告。

本机独立无界面 Chrome：验证三张样例、五项参数和导出值、背景切换、复制反馈、手动降级、高对比度降级、C 开关的实际截图像素差异、390px 移动视口无横向溢出，并检查无页面 JavaScript 异常。已查看桌面和移动端截图。

尚未验证：真实 Safari/WebKit、iPhone/iPad 真机、老版本浏览器以及长时间滚动/低端机性能。Chrome 移动仿真不能替代 Safari 真机测试；正式接入业务页面前需补齐这些验收。

可选浏览器检查需已有 Playwright 和 Chrome，未新增项目依赖：

```sh
KNOWFLOW_PLAYWRIGHT=/absolute/path/to/playwright/index.mjs \
KNOWFLOW_CHROME=/absolute/path/to/chrome \
node app/tests/design-lab.browser.mjs
```

`KNOWFLOW_TEST_URL` 可覆盖默认的 `http://127.0.0.1:3000`；上述变量只供手动测试，不是应用或部署所需配置。截图写入系统临时目录。
