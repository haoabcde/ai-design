# 折光 FOLD：生图版两页样册

生成方式：内置 imagegen。产品为虚构概念，不是实物照片或性能证明。最终两页均为 1055×1491 PNG；文字是图像的一部分。

## 第 1 页主简报（摘要）

整页 A4 比例产品手册封面；暖白纸张背景、中文衬线、深色字与钴蓝灯具。产品固定为：低矮圆形蓝色底座、直立细灯杆、不对称双折面灯罩和暖白扩散面。准确文案：折光、FOLD、让光，落在日常。、模块灯具概念、概念设计 · 非实物产品、01。不得添加价格、参数与背书。完整画面由生图完成。

## 第 2 页实际提示词

参考输入：`pages/page-01.png`，用于产品与全书视觉一致性。

Create ONE new complete flat portrait product-brochure page, page 2 in a two-page booklet. Use the attached page 1 as the exact visual reference for product identity and the booklet's typography, warm paper tone and cobalt-blue color. Preserve the same lamp: broad low circular cobalt base, slim straight vertical blue stem, angular asymmetrical folded sheet-metal canopy with two planes and warm white diffuser under it. Do not redesign the lamp, add hinges, change the base shape, or invent performance claims. This page is a calm interior application page, with a different composition from page 1: a generous typographic top area, below it a beautifully composed large landscape-cropped scene of that exact lamp on a pale timber desk with one closed book, soft evening light and restrained architectural detail. The scene is rendered within this flat designed page, without a book mockup or perspective page. Use a smaller supporting close-up of the same folded shade only if it improves the composition; preserve ample clear space. Match page 1 aspect ratio, close to A4 portrait, high resolution. Exact text only: at top small wordmark “FOLD / 折光”; main Chinese headline in two lines “为不同的时刻” and “留一束光”; small secondary line “阅读 · 陪伴 · 放松”; short caption “三个使用场景的概念演示”; footer “概念设计 · 非实物产品”; page number “02” bottom right. Do not add other words, prices, measurements or fake claims. Render all Chinese correctly. Put all copy within margins and keep body text readable. Make it feel like the same editorial product designer composed both pages, with carefully aligned type, optical spacing and deliberate white space. Only one final brochure page, no collage of multiple pages, no outer frame, no crop marks.

## 一次局部修订

初稿虽然准确生成了要求的“三个使用场景的概念演示”，但实际只有一个室内场景，因此修改为更准确的“日常照明的概念演示”。仅改这句，保留产品、排版和其他内容；最终保存 `pages/page-02.png`。

实际编辑提示词：

Edit only the small caption immediately below the large interior photograph on this completed brochure page. Replace the exact current caption “三个使用场景的概念演示” with the exact new caption “日常照明的概念演示”. Preserve its font style, approximate size, alignment and position. Preserve everything else exactly: all other Chinese text, FOLD / 折光 wordmark, main headline, 阅读 · 陪伴 · 放松, product lamp identity and shape, photograph, paper texture, colors, margins, footer and page number 02. Do not regenerate or redesign the layout. The caption should describe the single interior scene accurately.

## 核对与复现

已查看两页实际生成图，核对中文、页码、产品形象与参考关系；不构成生成效果稳定性的统计评测。按明确页序用 `scripts/images-to-pdf.py` 合页，完整等比放置，不裁切或拉伸。A4 下约 127.6 ppi，用于屏幕审阅示例，不作高分辨率印刷样张。

从 skill 目录执行（Python 需可选依赖 reportlab）：

```bash
python3 scripts/images-to-pdf.py --images examples/fold-concept/pages/page-01.png examples/fold-concept/pages/page-02.png --output output/fold-concept.pdf
```

后续续作可使用 [booklet.json](booklet.json) 保存页序、检查状态和参考关系，以及 [全书简报](brief.md) 与逐页 `prompts/`。逐页文件是整理后的当前完整提示词，第 2 页已包含修正图注；上文保留实际生成与修改记录。清单导出：

```bash
python3 scripts/images-to-pdf.py --manifest examples/fold-concept/booklet.json --output output/fold-concept-reviewed.pdf
```
