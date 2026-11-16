# 进展

## 2026-11-16

已完成首批优化：单页设计与产品手册；生图是正式设计路线，产品手册可选整页生图或 HTML 排版。原 skill 名保持兼容。

GitHub 仓库更名为 [haoabcde/ai-design](https://github.com/haoabcde/ai-design)，本地 origin 与安装说明同步更新。[PR #1](https://github.com/haoabcde/ai-design/pull/1) 已合并到默认主分支 `master`，合并提交为 `2624969`。

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

### 合并后吸收同类项目做法

重新核对 baoyu 系列图片流程的逐页提示词、首图参考与保留成功页面做法，以及 Creative Production 对固定身份和可变场景的区分。没有复制第三方代码或接入额外生图后端。

- 增加可选 `booklet.json`，记录共同简报、页序、每页完整提示词、参考角色及生成／目检状态；现有样册补上可复用的逐页文件。
- `images-to-pdf.py --manifest` 在导出前检查文件、唯一页 id 与 `reviewed` 状态，缺页或未检查的草稿不会被静默跳过。允许不同页有意复用同一图片。
- 目检状态由 Agent 查看成品后更新，不增加用户确认步骤。原 `--images` 参数继续可用，简单项目不必使用清单。
- 新增 8 项 Python 测试，在带 reportlab／pypdf 的环境全部通过；无 reportlab 环境通过 6 项元数据测试、跳过 2 项 PDF 集成测试。
- 结构自检现为 30 项，skill 校验通过。使用实际样册从不同工作目录导出 2 页 A4 PDF，验证页序、标题和嵌入像素与原图一致，未重新生成图像。

验证摘要见 [清单导出证据](docs/research/evidence/2026-11-16-booklet-manifest.json)。这次验证针对续作与导出可靠性，没有新增生图质量对照实验。

### HTML 大字排版与江苏旅游样册

用户补充：产品／研学类手册使用 HTML 时，字号要舒适，前端排版要好看；本轮以江苏旅游替代信息较少的南科大作为主示例。只修改 HTML 指导、机制模板与相关示例。

- 新增 [水岸江苏](product-brochure-designer/examples/jiangsu-waterways/brochure.html)，六页完整旅行提案：封面、三城六日日程、南京／扬州／苏州专页、出发与预约指引。附 [可直接查看的 PDF](product-brochure-designer/examples/jiangsu-waterways/brochure.pdf) 与 README 预览。
- 先查询秦淮区政府、中山陵园管理局、文旅部、博物馆官方资料、苏州市政府及 UNESCO 等内容；路线与五晚住宿分配明确为编辑建议。没有填写商业报价、虚构预订或把临时假期政策写成常规政策。
- 三张摄影逐项核对 Commons 的原作、作者、CC 许可，在 HTML／PDF 图注和 [来源说明](product-brochure-designer/examples/jiangsu-waterways/sources.md) 中保留署名、许可、裁切与资料摄影说明；不套用仓库代码的 MIT 许可。
- HTML 手册默认正文改为 A4 14–16pt，非核心图注11–12pt；手机约18–20px，窄屏单列重排。旅游样册实测打印14pt、手机18px。来源、行程与预约信息保持可选中和可修改的 HTML 文字。
- 模板补充 viewport、大字号与手机重排，保留原六类语义锚点。共享设计参考不再把10–11pt作为通用手册起点；不把新样册的页数或审美变成所有设计的固定要求。

验证：13项 Node 测试、30项结构检查、skill 校验均通过；新样册 delivery 静态检查无错误或警告。浏览器检查1280px桌面、375px手机及640px重排，手机文档宽度等于视口；目录跳转与打印按钮可用。填入实际文字与图片的模板样稿共7页，打印文字无页外溢出，375px时正文18px且无横向溢出。

PDF逐页查看，修复南京深色页的文字继承颜色、总览短行断句。最终6页均为A4，关键文字与页码可提取、链接不指向本地预览服务器；页面边界与页脚间距检查通过。证据见 [验证摘要](docs/research/evidence/2026-11-16-jiangsu-html.json)。这是旅行提案和视觉样册，没有实际订票、实地踏勘或商业印刷打样；出发前仍需重查开放与预约公告。
