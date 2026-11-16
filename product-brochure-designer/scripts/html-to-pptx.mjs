#!/usr/bin/env node
/**
 * html-to-pptx.mjs — 把按 templates/brochure.html 语义 class 编写的 A4 手册 HTML
 * 转换为可编辑的 PPTX（A4 竖版）。
 *
 * 工作原理：识别模板定义的语义锚点 class（page-cover / page-split / page-bleed /
 * page-timeline / page-specs / page-closing），把每页映射为 pptxgenjs 对象：
 * 文字保留为可编辑文本框，图片以 cover 模式等比裁切填入。
 *
 * 定位：PDF（由浏览器打印 HTML 得到）是高保真交付线；PPTX 是可编辑草稿线——
 * 字号行高按 mm 近似换算，图片为居中裁切（pptxgenjs 不支持 object-position 焦点，
 * 焦点裁切需求请在 PowerPoint/WPS 中手动微调），转换后逐页核对内容。
 * 模板以外的页面或过长时间轴会明确报错，不输出缺页草稿（PDF 不受影响）。
 *
 * 用法：node scripts/html-to-pptx.mjs --html brochure.html --output out.pptx
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseHtml, elements, hasClass, innerHtml, textContent, byClass } from './lib/html.mjs';
import { parseArgs, requireArgs, isMain, localAssetPath } from './lib/utils.mjs';

const MM = 1 / 25.4; // mm → inch
const PAGE_W = 210 * MM;
const PAGE_H = 297 * MM;

// ---------- 解析辅助 ----------

const stripTags = (s) => textContent(parseHtml(s || '')).trim();

/** 按 class 提取第一个匹配元素的内部文本 */
function pick(html, cls) {
  const node = byClass(html, cls)[0];
  return node ? textContent(node).trim() : '';
}

/** 按 class 提取所有匹配块的内部 HTML */
function pickAll(html, cls) {
  return byClass(html, cls).map(innerHtml);
}

function pickTag(html, tag) {
  const node = elements(parseHtml(html), (node) => node.tag === tag)[0];
  return node ? textContent(node).trim() : '';
}

function footerText(html) {
  const footer = byClass(html, 'footer')[0];
  return footer ? pickTag(innerHtml(footer), 'span') : '';
}

/** 提取第一个 img 的 src */
function pickImg(html) {
  return elements(parseHtml(html), (node) => node.tag === 'img')[0]?.attrs.src || null;
}

/** 从 <style> 的 :root 提取 CSS 变量 */
function parseTokens(html) {
  const root = html.replace(/\/\*[\s\S]*?\*\//g, '').match(/:root\s*\{([\s\S]*?)\}/)?.[1] || '';
  const vars = {};
  for (const m of root.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  const font = (stack, fallback) => {
    const first = (stack || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
    return first || fallback;
  };
  return {
    bg: (vars.bg || '#FFFFFF').replace('#', ''),
    ink: (vars.ink || '#1A1A1A').replace('#', ''),
    accent: (vars.accent || '#2D6CDF').replace('#', ''),
    overlay: (vars.overlay || '#102A43').replace('#', ''),
    fontTitle: font(vars['font-title'], 'Noto Serif SC'),
    fontBody: font(vars['font-body'], 'Microsoft YaHei'),
    margin: (parseFloat(vars.margin) || 16) * MM,
  };
}

/** 解析行内 style 里的数值属性（如 margin-top:6mm → 6） */
function inlineMm(html, cls, prop) {
  const re = new RegExp(`<\\w+[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*style="[^"]*${prop}\\s*:\\s*([\\d.]+)mm`);
  const m = html.match(re);
  return m ? parseFloat(m[1]) : 0;
}

// ---------- 页面渲染器（pptxgenjs） ----------

/** 文字压图的渐变遮罩近似：全页薄罩 + 下部加深罩 */
function addShade(slide, t, { full = 60, bottomBand = 30, bandTop = 0.5 } = {}) {
  slide.addShape('rect', { x: 0, y: 0, w: PAGE_W, h: PAGE_H, fill: { color: t.overlay, transparency: full }, line: { type: 'none' } });
  slide.addShape('rect', { x: 0, y: PAGE_H * bandTop, w: PAGE_W, h: PAGE_H * (1 - bandTop), fill: { color: t.overlay, transparency: bottomBand }, line: { type: 'none' } });
}

function addFooter(slide, t, brand, pageNo, dark = false) {
  const color = dark ? 'FFFFFF' : t.ink;
  slide.addText(brand || '', { x: t.margin, y: PAGE_H - 14 * MM, w: PAGE_W / 2, h: 4 * MM, fontFace: t.fontBody, fontSize: 7.5, color, transparency: 35 });
  slide.addText(String(pageNo).padStart(2, '0'), { x: PAGE_W - t.margin - 20 * MM, y: PAGE_H - 14 * MM, w: 20 * MM, h: 4 * MM, align: 'right', fontFace: t.fontBody, fontSize: 7.5, color, transparency: 35 });
}

async function renderCover(slide, sec, t, dir) {
  const img = pickImg(sec);
  if (img) {
    slide.addImage({ path: localAssetPath(img, dir), x: 0, y: 0, w: PAGE_W, h: PAGE_H, sizing: { type: 'cover', x: 0, y: 0, w: PAGE_W, h: PAGE_H } });
    addShade(slide, t, { full: 62, bottomBand: 18, bandTop: 0.45 });
  }
  const label = pick(sec, 'label');
  const title = pick(sec, 'cover-title');
  const sub = pick(sec, 'cover-sub');
  const meta = pick(sec, 'cover-meta');
  let y = PAGE_H - 66 * MM;
  if (label) { slide.addText(label, { x: t.margin, y, w: PAGE_W - 2 * t.margin, h: 5 * MM, fontFace: t.fontBody, fontSize: 8, bold: true, color: t.accent, charSpacing: 2.5 }); y += 7 * MM; }
  slide.addText(title, { x: t.margin, y, w: PAGE_W - 2 * t.margin, h: 30 * MM, fontFace: t.fontTitle, fontSize: 30, bold: true, color: 'FFFFFF', valign: 'top' });
  y += 32 * MM;
  if (sub) { slide.addText(sub, { x: t.margin, y, w: PAGE_W - 2 * t.margin, h: 8 * MM, fontFace: t.fontBody, fontSize: 12, color: 'FFFFFF', transparency: 8 }); y += 9 * MM; }
  if (meta) slide.addText(meta, { x: t.margin, y: y + 6 * MM, w: PAGE_W - 2 * t.margin, h: 4 * MM, fontFace: t.fontBody, fontSize: 7.5, color: 'FFFFFF', transparency: 30, charSpacing: 2 });
}

async function renderSplit(slide, sec, t, dir, classes, pageNo) {
  const photoLeft = classes.includes('photo-left');
  const img = pickImg(sec);
  const photoW = img ? PAGE_W * 0.4 : 0;
  const textW = PAGE_W - photoW;
  const textX = photoLeft ? photoW : 0;
  if (img) {
    const px = photoLeft ? 0 : textW;
    slide.addImage({ path: localAssetPath(img, dir), x: px, y: 0, w: photoW, h: PAGE_H, sizing: { type: 'cover', x: px, y: 0, w: photoW, h: PAGE_H } });
    slide.addShape('rect', { x: px, y: 0, w: photoW, h: PAGE_H, fill: { color: t.overlay, transparency: 86 }, line: { type: 'none' } });
  }
  const pad = 12 * MM;
  let y = 16 * MM;
  const tx = textX + pad;
  const tw = textW - 2 * pad;
  const label = pick(sec, 'label');
  const title = pick(sec, 'page-title');
  if (label) { slide.addText(label, { x: tx, y, w: tw, h: 4 * MM, fontFace: t.fontBody, fontSize: 8, bold: true, color: t.accent, charSpacing: 2.5 }); y += 6 * MM; }
  if (title) { slide.addText(title, { x: tx, y, w: tw, h: 22 * MM, fontFace: t.fontTitle, fontSize: 22, bold: true, color: t.ink, valign: 'top' }); y += 24 * MM; }
  const body = pickAll(sec, 'body-text').map(stripTags).join('\n\n');
  if (body) {
    const top = y + (inlineMm(sec, 'body-text', 'margin-top') || 4) * MM;
    slide.addText(body, { x: tx, y: top, w: tw, h: 80 * MM, fontFace: t.fontBody, fontSize: 10.5, color: t.ink, lineSpacing: 10.5 * 1.85, valign: 'top' });
    y = top + Math.max(24 * MM, Math.ceil(body.length / 26) * 5.8 * MM) + 6 * MM;
  }
  for (const item of pickAll(sec, 'num-item')) {
    const num = pick(item, 'num');
    const h3 = pickTag(item, 'h3');
    const p = pickTag(item, 'p');
    slide.addText(num, { x: tx, y, w: 14 * MM, h: 10 * MM, fontFace: t.fontTitle, fontSize: 20, bold: true, color: t.accent, valign: 'top' });
    const lines = Math.max(1, Math.ceil(p.length / 30));
    slide.addText([
      { text: h3, options: { fontFace: t.fontBody, fontSize: 11.5, bold: true, color: t.ink, breakLine: true } },
      { text: p, options: { fontFace: t.fontBody, fontSize: 9.5, color: t.ink, transparency: 18, lineSpacing: 9.5 * 1.7 } },
    ], { x: tx + 19 * MM, y, w: tw - 19 * MM, h: (6 + lines * 4.6) * MM, valign: 'top' });
    y += (12 + lines * 4.6) * MM;
  }
  addFooter(slide, t, footerText(sec), pageNo);
}

async function renderBleed(slide, sec, t, dir) {
  const img = pickImg(sec);
  if (img) {
    slide.addImage({ path: localAssetPath(img, dir), x: 0, y: 0, w: PAGE_W, h: PAGE_H, sizing: { type: 'cover', x: 0, y: 0, w: PAGE_W, h: PAGE_H } });
    slide.addShape('rect', { x: 0, y: 0, w: PAGE_W, h: PAGE_H, fill: { color: t.overlay, transparency: 45 }, line: { type: 'none' } });
  } else {
    slide.background = { color: t.overlay };
  }
  const title = pick(sec, 'bleed-title');
  const text = pick(sec, 'bleed-text');
  let y = PAGE_H * 0.42;
  slide.addText(title, { x: t.margin, y, w: 150 * MM, h: 40 * MM, fontFace: t.fontTitle, fontSize: 26, bold: true, color: 'FFFFFF', lineSpacing: 26 * 1.35, valign: 'top' });
  y += Math.max(30 * MM, Math.ceil(title.length / 14) * 10 * MM) + 6 * MM;
  if (text) slide.addText(text, { x: t.margin, y, w: 128 * MM, h: 50 * MM, fontFace: t.fontBody, fontSize: 11, color: 'FFFFFF', transparency: 5, lineSpacing: 11 * 1.9, valign: 'top' });
}

async function renderTimeline(slide, sec, t, pageNo) {
  let y = 16 * MM;
  const label = pick(sec, 'label');
  const title = pick(sec, 'page-title');
  if (label) { slide.addText(label, { x: t.margin, y, w: PAGE_W - 2 * t.margin, h: 4 * MM, fontFace: t.fontBody, fontSize: 8, bold: true, color: t.accent, charSpacing: 2.5 }); y += 6 * MM; }
  if (title) { slide.addText(title, { x: t.margin, y, w: PAGE_W - 2 * t.margin, h: 22 * MM, fontFace: t.fontTitle, fontSize: 22, bold: true, color: t.ink, valign: 'top' }); y += 30 * MM; }
  const items = pickAll(sec, 'tl-item');
  const railX = t.margin + 2 * MM;
  if (items.length) slide.addShape('line', { x: railX, y: y + 2 * MM, w: 0, h: Math.min(items.length, 8) * 24 * MM, line: { color: t.accent, width: 1.2 } });
  for (const item of items) {
    const time = pick(item, 'tl-time');
    const name = pick(item, 'tl-title');
    const desc = pick(item, 'tl-desc');
    slide.addShape('ellipse', { x: railX - 2.2 * MM, y: y + 1.4 * MM, w: 4.4 * MM, h: 4.4 * MM, fill: { color: t.accent }, line: { type: 'none' } });
    slide.addText([
      { text: `${time}  `, options: { fontFace: t.fontBody, fontSize: 9.5, bold: true, color: t.accent } },
      { text: name, options: { fontFace: t.fontBody, fontSize: 11.5, bold: true, color: t.ink, breakLine: true } },
      { text: desc, options: { fontFace: t.fontBody, fontSize: 9.5, color: t.ink, transparency: 18, lineSpacing: 9.5 * 1.7 } },
    ], { x: railX + 10 * MM, y, w: PAGE_W - railX - 10 * MM - t.margin, h: 22 * MM, valign: 'top' });
    y += 24 * MM;
  }
  addFooter(slide, t, footerText(sec), pageNo);
}

async function renderSpecs(slide, sec, t, pageNo) {
  let y = 16 * MM;
  const label = pick(sec, 'label');
  const title = pick(sec, 'page-title');
  if (label) { slide.addText(label, { x: t.margin, y, w: PAGE_W - 2 * t.margin, h: 4 * MM, fontFace: t.fontBody, fontSize: 8, bold: true, color: t.accent, charSpacing: 2.5 }); y += 6 * MM; }
  if (title) { slide.addText(title, { x: t.margin, y, w: PAGE_W - 2 * t.margin, h: 22 * MM, fontFace: t.fontTitle, fontSize: 22, bold: true, color: t.ink, valign: 'top' }); y += 28 * MM; }
  const specs = pickAll(sec, 'spec');
  const colW = (PAGE_W - 2 * t.margin - 12 * MM) / 2;
  specs.forEach((spec, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = t.margin + col * (colW + 12 * MM);
    const sy = y + row * 22 * MM;
    slide.addText([
      { text: pickTag(spec, 'dt'), options: { fontFace: t.fontBody, fontSize: 8.5, bold: true, color: t.accent, breakLine: true } },
      { text: pickTag(spec, 'dd'), options: { fontFace: t.fontBody, fontSize: 10.5, color: t.ink, lineSpacing: 10.5 * 1.6 } },
    ], { x, y: sy, w: colW, h: 18 * MM, valign: 'top' });
    slide.addShape('line', { x, y: sy + 19 * MM, w: colW, h: 0, line: { color: t.ink, width: 0.4, transparency: 60 } });
  });
  addFooter(slide, t, footerText(sec), pageNo);
}

async function renderClosing(slide, sec, t, dir) {
  const img = pickImg(sec);
  if (img) slide.addImage({ path: localAssetPath(img, dir), x: 0, y: 0, w: PAGE_W, h: PAGE_H, transparency: 65, sizing: { type: 'cover', w: PAGE_W, h: PAGE_H } });
  const title = pick(sec, 'closing-title');
  const contact = pick(sec, 'contact');
  const disclaimer = pick(sec, 'disclaimer');
  slide.addText(title, { x: t.margin, y: PAGE_H * 0.2, w: 150 * MM, h: 40 * MM, fontFace: t.fontTitle, fontSize: 24, bold: true, color: 'FFFFFF', lineSpacing: 24 * 1.35, valign: 'top' });
  if (contact) slide.addText(contact, { x: t.margin, y: PAGE_H - 60 * MM, w: PAGE_W - 2 * t.margin, h: 30 * MM, fontFace: t.fontBody, fontSize: 11, color: 'FFFFFF', lineSpacing: 11 * 2, valign: 'top' });
  if (disclaimer) slide.addText(disclaimer, { x: t.margin, y: PAGE_H - 24 * MM, w: PAGE_W - 2 * t.margin, h: 10 * MM, fontFace: t.fontBody, fontSize: 7.5, color: 'FFFFFF', transparency: 35, lineSpacing: 7.5 * 1.7, valign: 'top' });
}

// ---------- 主流程 ----------

export async function htmlToPptx(htmlPath, outPath) {
  const html = await fs.readFile(htmlPath, 'utf8');
  const sections = elements(parseHtml(html), (node) => node.tag === 'section' && hasClass(node, 'page'));
  if (!sections.length) throw new Error('未找到 section.page；未生成 PPTX');
  const supported = ['page-cover', 'page-split', 'page-bleed', 'page-timeline', 'page-specs', 'page-closing'];
  const unsupported = sections.flatMap((node, index) => supported.some((name) => hasClass(node, name)) ? [] : [index + 1]);
  if (unsupported.length) throw new Error(`第 ${unsupported.join(', ')} 页不是可转换的语义版式；未生成 PPTX。保留 PDF，或先将这些页改为支持的版式。`);
  const dir = path.dirname(path.resolve(htmlPath));
  for (const [index, node] of sections.entries()) {
    const content = innerHtml(node);
    if (hasClass(node, 'page-timeline') && byClass(content, 'tl-item').length > 8) throw new Error(`第 ${index + 1} 页时间轴超过 8 项，请先分页；未生成 PPTX`);
    const photos = elements(node, (child) => child.tag === 'img');
    if (photos.length > 1) throw new Error(`第 ${index + 1} 页超过一张图片，语义转换无法完整保留；未生成 PPTX`);
    for (const photo of photos) {
      const file = localAssetPath(photo.attrs.src, dir);
      if (!file || !(await fs.stat(file).catch(() => null))?.isFile()) throw new Error(`第 ${index + 1} 页图片不存在或不是本地文件：${photo.attrs.src}`);
    }
  }
  let pptxgen;
  try { pptxgen = (await import('pptxgenjs')).default; }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') throw new Error('PPTX 转换需要可选依赖：请在 skill 目录运行 pnpm install');
    throw error;
  }
  const t = parseTokens(html);
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'A4P', width: PAGE_W, height: PAGE_H });
  pptx.layout = 'A4P';

  for (const [index, node] of sections.entries()) {
    const classes = node.attrs.class;
    const sec = innerHtml(node);
    const pageNo = index + 1;
    const slide = pptx.addSlide();
    const dark = ['page-cover', 'page-closing', 'page-bleed'].some((name) => hasClass(node, name));
    slide.background = { color: dark ? t.overlay : t.bg };
    if (hasClass(node, 'page-cover')) await renderCover(slide, sec, t, dir);
    else if (hasClass(node, 'page-split')) await renderSplit(slide, sec, t, dir, classes, pageNo);
    else if (hasClass(node, 'page-bleed')) await renderBleed(slide, sec, t, dir);
    else if (hasClass(node, 'page-timeline')) await renderTimeline(slide, sec, t, pageNo);
    else if (hasClass(node, 'page-specs')) await renderSpecs(slide, sec, t, pageNo);
    else if (hasClass(node, 'page-closing')) await renderClosing(slide, sec, t, dir);
  }
  await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
  await pptx.writeFile({ fileName: outPath });
  return { pages: sections.length, slides: sections.length, skipped: [] };
}

if (isMain(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2), { values: ['html', 'output'], flags: ['help'] });
    if (args.help) console.log('用法: node scripts/html-to-pptx.mjs --html brochure.html --output out.pptx');
    else {
      requireArgs(args, ['html', 'output']);
      const result = await htmlToPptx(args.html, args.output);
      console.log(JSON.stringify({ ok: true, output: args.output, ...result }, null, 2));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
