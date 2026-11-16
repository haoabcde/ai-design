#!/usr/bin/env node
// Static checks complement browser inspection; they do not validate layout or truth.
import fs from 'node:fs/promises';
import path from 'node:path';
import { INTERNAL_KEY, readData, parseArgs, isMain, localAssetPath } from './lib/utils.mjs';
import { parseHtml, elements, hasClass, textContent, imageReferences } from './lib/html.mjs';

const DELIVERY_SOURCES = new Set(['client_supplied', 'official_wechat', 'official_web', 'licensed', 'ai_generated']);
const AD_CLAIM = /(?:保过|包过|百分百|100%|确保(?:升学|录取|通过|入学|就业)|保证(?:升学|录取|通过|入学|效果)|承诺(?:升学|录取|效果)|最(?:好|优|强|受欢迎|具影响力)|顶级|第一品牌|首选品牌|国家级|权威认证|官方指定|独家合作|名校直通|guaranteed)/i;
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export async function check({ html: htmlPath, product, images, mode = 'delivery' }) {
  if (!['draft', 'delivery'].includes(mode)) throw new Error('--mode 只能为 draft 或 delivery');
  if (!htmlPath && !product && !images) throw new Error('至少提供 --html、--product 或 --images');
  const issues = [];
  const pending = [];
  const references = [];
  let pageCount = 0;
  const issue = (code, detail, level = 'ERROR') => issues.push({ code, level, detail });
  const matches = (text, pattern) => [...new Set(text.match(new RegExp(`.{0,12}${pattern.source}.{0,12}`, 'gi')) || [])];

  if (htmlPath) {
    const html = await fs.readFile(htmlPath, 'utf8');
    const root = parseHtml(html);
    const nodes = elements(root);
    pageCount = nodes.filter((node) => node.tag === 'section' && hasClass(node, 'page')).length;
    if (!pageCount) issue('NO_PAGES', '未找到 <section class="page"> 页面');
    const copy = textContent(root) + '\n' + nodes.flatMap((node) => [node.attrs.alt, node.attrs.title, node.attrs['aria-label']]).filter(Boolean).join('\n');
    const leaks = matches(copy, INTERNAL_KEY);
    if (leaks.length) issue('INTERNAL_FIELD_LEAK', leaks);
    const claims = matches(copy, AD_CLAIM);
    if (claims.length) issue('AD_CLAIM', claims, 'WARNING');
    pending.push(...(copy.match(/【待确认[^】]*】[^，。\n]{0,30}/g) || []));
    const placeholders = [...new Set(html.replace(/<!--[\s\S]*?-->/g, '').match(/\{\{[^{}]+\}\}/g) || [])];
    if (placeholders.length) issue('TEMPLATE_PLACEHOLDER', placeholders, mode === 'draft' ? 'WARNING' : 'ERROR');
    if (nodes.some((node) => node.tag === 'base')) issue('BASE_URL', '请移除 <base>，使用相对 HTML 的本地素材路径');
    if (nodes.some((node) => node.tag === 'script')) issue('DYNAMIC_HTML', '脚本可能改变页面内容，静态检查不能验证最终内容', 'WARNING');
    if (nodes.some((node) => node.tag === 'link' && /stylesheet/i.test(node.attrs.rel || ''))) {
      issue('EXTERNAL_STYLESHEET', '请将交付样式内联到 HTML，以便核对图片引用');
    }
    for (const ref of imageReferences(root)) {
      let file;
      try { file = localAssetPath(ref, path.dirname(path.resolve(htmlPath))); } catch { /* invalid URI */ }
      if (!file) { issue('IMAGE_NOT_LOCAL', ref || 'img 缺少 src'); continue; }
      references.push({ ref, file });
      const stat = await fs.stat(file).catch(() => null);
      if (!stat?.isFile() || !stat.size) issue('IMAGE_FILE_MISSING', ref);
    }
    if (references.length && !images) issue('IMAGE_MANIFEST_REQUIRED', 'HTML 使用了图片，请提供 --images images.json');
  }

  if (product) {
    const data = await readData(path.resolve(product));
    if (!object(data)) issue('PRODUCT_SHAPE', 'product 应为对象');
    else {
      const leaks = matches(JSON.stringify(data), INTERNAL_KEY);
      if (leaks.length) issue('INTERNAL_FIELD_IN_PRODUCT', leaks);
      for (const key of ['name', 'description']) if (!nonempty(data[key])) pending.push(`product.${key} 缺失`);
      if (!nonempty(data.audience)) issue('AUDIENCE_MISSING', 'product.audience 未填写；请明确读者或在交付说明中记录假设', 'WARNING');
    }
  }

  if (images) {
    const manifestPath = path.resolve(images);
    const data = await readData(manifestPath);
    if (!object(data) || !Array.isArray(data.images)) issue('IMAGE_MANIFEST_SHAPE', '图片清单必须含有 images 数组');
    else {
      const entries = new Map();
      const ids = new Set();
      for (const entry of data.images) {
        if (!object(entry) || !['id', 'path', 'role', 'status', 'sourceType'].every((key) => nonempty(entry[key])) || !['preview', 'approved'].includes(entry.status)) {
          issue('IMAGE_MANIFEST_ENTRY', '每项需要 id/path/role/status/sourceType，status 为 preview 或 approved');
          continue;
        }
        const file = path.resolve(path.dirname(manifestPath), entry.path);
        if (ids.has(entry.id) || entries.has(file)) issue('IMAGE_MANIFEST_DUPLICATE', entry.id);
        ids.add(entry.id);
        entries.set(file, entry);
      }
      const used = htmlPath ? references : [...entries.keys()].map((file) => ({ file, ref: file }));
      for (const { file, ref } of used) {
        const entry = entries.get(file);
        if (!entry) { issue('IMAGE_NOT_IN_MANIFEST', ref); continue; }
        const level = mode === 'draft' ? 'WARNING' : 'ERROR';
        if (entry.status !== 'approved' || !DELIVERY_SOURCES.has(entry.sourceType)) issue('IMAGE_NOT_DELIVERABLE', `${entry.id}: status=${entry.status}, sourceType=${entry.sourceType}`, level);
        if (!nonempty(entry.rights)) issue('IMAGE_RIGHTS_MISSING', `${entry.id}: 请记录使用许可或授权依据`, level);
        if (['official_web', 'official_wechat', 'licensed'].includes(entry.sourceType) && !/^https?:\/\//i.test(entry.sourceUrl || '')) {
          issue('IMAGE_SOURCE_MISSING', `${entry.id}: 请记录来源 URL`, level);
        }
        if (entry.sourceType === 'ai_generated' && entry.usage !== 'illustration') issue('GENERATED_IMAGE_USAGE', `${entry.id}: 生成图只能标记为 illustration，不能作为真实场景证明`, level);
        if (!htmlPath) {
          const stat = await fs.stat(file).catch(() => null);
          if (!stat?.isFile() || !stat.size) issue('IMAGE_FILE_MISSING', entry.path);
        }
      }
    }
  }

  const pendingFacts = [...new Set(pending)];
  if (pendingFacts.length) issue('PENDING_FACT', pendingFacts, mode === 'draft' ? 'WARNING' : 'ERROR');
  const errors = issues.filter((entry) => entry.level === 'ERROR');
  return {
    pass: errors.length === 0, mode, pages: pageCount,
    referencedImages: references.length, errors,
    warnings: issues.filter((entry) => entry.level === 'WARNING'), pendingFacts,
    manualChecks: ['渲染后核对文字、字体、对比度、裁切与内容溢出', '核实事实、宣传措辞和素材授权范围', '核对最终 PNG/PDF/PPTX 的尺寸、页数与内容完整性']
  };
}

if (isMain(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2), { values: ['html', 'product', 'images', 'mode'], flags: ['help'] });
    if (args.help) console.log('用法: node scripts/check.mjs --html design.html [--product product.json] [--images images.json] [--mode draft|delivery]');
    else {
      const report = await check(args);
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.pass ? 0 : 2;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
