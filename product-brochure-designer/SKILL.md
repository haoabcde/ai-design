---
name: product-brochure-designer
description: Create static graphics with a visual concept, image generation/editing and precise layout, including posters, covers, promotional images and multi-page brochures. Use for art direction, composition, typography, visual refinement and PNG/PDF delivery. Brochures support whole-page image generation or HTML while preserving supplied copy, brand assets and facts. Does not cover interactive UI, video or 3D production.
---

# 平面设计与产品手册

从内容形成视觉概念，用图像、排字与构图完成设计。生图与图像编辑是正式设计手段，也保留精确排版路线。首批支持**单页设计**和**产品手册**；手册可以整页生图，也可以用 HTML 排版。保留 `product-brochure-designer` 名称以兼容已有安装。

## 1. 理解任务并选择流程

利用用户提供的文案、素材、参考图和已有项目上下文，确定：用途与读者、希望读者记住或采取的行动、必须保留的内容、尺寸与交付格式。已有信息足够时直接推进；缺少关键事实或无法推断的交付要求时才询问。

- **海报、封面、宣传图、Banner、邀请图或已有图改版**：读 [单页设计](references/single-page.md)。
- **产品手册、研学手册、旅游手册、宣传册、项目目录**：读 [多页手册](references/brochure.md)。
- 两者都用 [设计判断](references/design-system.md)；方向不明确或需要探索时再读 [风格方向](references/style-directions.md)。
- 使用生图／图像编辑时，读 [生图设计](references/image-generation.md)，包括整页设计和多页一致性。
- 用户只要 prompt、评审或局部修改时，交付其所需结果，不自动扩展为完整设计项目。

不要把所有请求变成 A4，不强制单页设计填写 product.json，不为增加种类而额外引入流程。复杂信息图、完整品牌识别、摄影精修等若成为任务主体，使用相应专门工具与方法，明确本次可交付范围。

## 2. 先形成视觉概念，再做版式

先找当前内容特有的形态、动作或材料，把它转成可见的构图关系。例如水岸旅行可以让一条水线组织标题与行程；仪器手册可以让精密剖面承担叙事。说清主视觉是什么、字与图如何相互作用，以及这个关系如何延续到内页。“高级感、大字、留白、卡片”不足以构成概念。

方向开放、首次建立视觉体系，或用户反馈“没有设计感”时，读 [视觉发想与修订](references/art-direction.md)。先做有实质差异的关键画面，比较实际成品，再确定方向；不要直接把机制模板填满。手册宜同时试封面和一页内容较密的内页，避免只有封面好看。

- 尊重已有品牌、用户参考和准确文案。不要按人群标签机械分配风格，也不要擅自压暗品牌色。
- 信息少可以少做页数或用文字主导；信息多先编辑组织，不靠缩小字体塞满。
- 方向明确就直接完成；需要比较时给有实质区别的少量方向，不固定生成数量。
- 复用字体、色彩和空间关系，避免把同一构图重复当作所有任务的答案。
- 需要鲜明插画、拼贴、特殊材质或完整构图探索时，调用生图／图像编辑参与设计；需要精确文字时再用 HTML 或原生排版落实。参考与素材应服务具体概念，不以增加图片数量代替设计判断。

## 3. 按交付要求制作

| 主要要求 | 制作方式 |
|---|---|
| 直接完成海报、封面或整页视觉设计 | 使用宿主可用的生图／图像编辑工具完成整体构图、字图关系与风格；不默认只生成一张背景 |
| 生图版产品手册 | 按统一视觉简报逐页生成，以已选页面和产品图保持一致，校对后汇总 PDF；见生图设计参考 |
| 精确长文、价格日期、Logo、参数、稳定修改 | 保留可编辑排版层；可用原生设计工具或 HTML／SVG 排版，必要时组合生成素材 |
| 修改已有成品 | 保留原图与未修改内容，选择局部编辑或源文件修改；避免无必要地重做整张图 |

不能用程序画占位图冒充所需摄影或插画。生成素材与确定性排版可以组合，但不强制所有任务拆层。不得声称栅格图有可编辑文字层，也不得承诺 HTML 自动转换为任意原生设计文件。

HTML 参考模板只演示画布与导出机制：单页用 `templates/graphic.html`，A4 手册用 `templates/brochure.html`。设计不受模板示例构图限制。

## 4. 核对内容与素材

- 已提供的标题、日期、价格、参数、Logo 和联系方式逐项核对；不编造证明、数据、背书或真实场景。
- 缺失事实在草稿中标明，正式交付前补齐或取得用户明确的草稿交付要求。
- 成品默认只放服务读者的文案，不擅自添加设计者／工具署名、AI 生成标签、水印或通用免责声明。额外标注仅在用户要求或确有适用的发布要求时加入；制作说明与调研依据放在项目记录，必要的素材归属集中处理。
- 确认素材授权范围。客户素材、官方来源、授权图库及说明性生成图分别记录；公开可见不等于获准使用。细则见 [素材说明](references/image-policy.md)。
- 商业资料含内部信息或宣传措辞待审时，读 [事实与内部信息](references/fact-policy.md)。不要把内部资料放进客户输出。

HTML 使用本地图片时，可生成待审核清单（从 skill 目录执行）：

```bash
node scripts/image-workflow.mjs manifest --download-dir ./downloads --output images.json
```

路径相对清单文件；清单初始为 `preview`，审核后填写 `sourceType`、`rights` 和相应来源信息。脚本不抓图，也不会自动认定授权。

## 5. 渲染、复核与交付

**必须查看实际成品。** 用浏览器／设计工具渲染，等待字体与图片加载，核对画布边界、溢出、主体裁切、文字准确性和实际阅读尺寸。多页逐页看，再整体看一致性与节奏；改尺寸后重新检查内容重排。

另做视觉复核：缩略图的焦点、题材特征、字图关系、跨页节奏是否支持原概念。指出并修正最影响画面的具体问题；若只是合规、整齐而缺乏辨识度，回到概念与构图重做。技术检查通过不等于设计质量通过，作者自评也不等于用户认可。

HTML 交付前运行：

```bash
node scripts/check.mjs --html design.html --images images.json
# 产品手册可再提供 --product product.json；无图片时可省略 --images
# 草稿加 --mode draft：允许待确认内容，但仍报告缺图等错误
```

检查器只检查静态 HTML、素材引用和部分文案线索，不能证明视觉质量、事实或授权合法性；PNG／PDF 与生图结果仍需实际核对。无 ERROR 才能称通过该检查。

- **单页**：按目标尺寸交付 PNG；印刷需求另核对物理尺寸、PDF 与出血要求。
- **手册**：PDF 为主。HTML 版保存 HTML 与本地素材；生图版保存逐页原图、页序与关键提示词。可编辑 PPTX 仅支持 HTML 路线的已定义语义版式，见 [多页手册](references/brochure.md)。
- 说明最终文件、关键设计选择、已做核查及实际遗留问题。简单单图无需额外文档；多页或成套交付可写简短 `delivery-notes.md`。
- 不能渲染或无法核对最终文件时，明确标为未验证草稿，不称完成交付。

导出、字体和平台环境见 [平台说明](references/platform-notes.md)。
