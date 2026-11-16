# 进展

## 2026-11-16

已完成首批优化：单页设计与产品手册；生图是正式设计路线，产品手册可选整页生图或 HTML 排版。原 skill 名保持兼容。

### 主要变更

- 共享设计判断与单页／手册／生图参考分开，去掉固定页数、唯一遮罩做法、自动压暗品牌色等通用限制。
- 生图手册明确准确文案、参考图角色、产品身份、全书视觉规则、局部编辑与逐页验收；保存原图、提示词和页序。
- `check.mjs` 核对素材文件、清单对应、来源记录与模板占位，区分 draft／delivery，仍明确需要实际渲染与人工核查。
- 素材清单路径相对清单文件，稳定排序且不覆盖审核记录；支持客户素材及说明性生成图。
- PPTX 读取嵌套列表、行程和规格；不支持的页面和超长时间轴停止转换，不再输出静默缺失内容的文件。
- 冻结锁文件安装恢复可用。新增可选 `images-to-pdf.py`，按明确页序完整等比合页并报告有效 ppi。

### 验证

- `node --test tests/*.test.mjs`：13 项通过，包含实际 PPTX 压缩包中的内容核对。
- 无 node_modules 的隔离副本：12 项通过，可选 PPTX 内容测试跳过 1 项。
- `quick_validate.py` 通过；`smoke.mjs` 通过 29 项；`pnpm install --frozen-lockfile` 通过。
- [开放工作室](product-brochure-designer/examples/open-studio/)：浏览器查看横竖两版，修正装饰文字裁切；最终 PNG 尺寸 1080×1440、1920×1080。
- [折光 FOLD](product-brochure-designer/examples/fold-concept/prompts.md)：两页整页生图，第二页沿用第一页参考，局部修改一处不准确图注；中文、页码与产品外观已查看。两张原图均 1055×1491。
- 生图 PDF：2 页 A4，嵌入像素与原图逐字节一致，验证页序；已渲染查看。
- 原有研学 HTML 草稿：10 页 A4 PDF，逐页截图，所查文字元素无页外溢出；字体提取中的兼容字符经 Unicode NFKC 规范化后核对预期文字。
- PDF 合页的无效输入、已有输出保护已检查。
- 阅读 baoyu-skills、OpenAI Creative Production、NanoBanana-PPT-Skills、Banana Slides、Skill2Poster、Canvas Design 的原始资料，记录 [同类项目对照](docs/research/2026-11-16-同类项目对照.md)。补充生成前保存完整提示词，以及 HTML 路线可选生图视觉参考；未安装或实跑竞品。

### 实际边界

生图样册是虚构概念，约 127.6 ppi，供屏幕审阅；未做高分辨率印刷样张。HTML 检查不能证明布局、事实或授权，PPTX 仅支持语义版式且仍为近似排版。未做新旧版独立盲评或长手册生成稳定性评测，不将这些示例解释为任意任务效果保证。

基线调查见 [调研](docs/research/2026-11-16-设计Skill范围调研.md) 与 [复现摘要](docs/research/evidence/2026-11-16-baseline.json)。本地临时验证产物保存在被 Git 忽略的 `output/`，最终生图样册 PDF 在 `output/pdf/fold-concept.pdf`。
