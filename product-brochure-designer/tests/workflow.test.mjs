import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { check } from '../scripts/check.mjs';
import { manifest, analyze } from '../scripts/image-workflow.mjs';
import { htmlToPptx } from '../scripts/html-to-pptx.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'graphic-skill-test-'));
  const write = async (file, data) => {
    const target = path.join(dir, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, typeof data === 'string' ? data : JSON.stringify(data));
    return target;
  };
  try { return await run({ dir, write }); } finally { await fs.rm(dir, { recursive: true, force: true }); }
}
const codes = (report) => report.errors.map((issue) => issue.code);
const page = (copy) => `<section class='page page-graphic'>${copy}</section>`;

test('missing files, an empty manifest, and template copy cannot pass delivery', () => fixture(async ({ write }) => {
  const html = await write('design.html', page('<h1>{{产品名}}</h1><img src="missing.jpg">'));
  const images = await write('images.json', { images: [] });
  const report = await check({ html, images });
  assert.equal(report.pass, false);
  for (const code of ['TEMPLATE_PLACEHOLDER', 'IMAGE_FILE_MISSING', 'IMAGE_NOT_IN_MANIFEST']) assert.ok(codes(report).includes(code));
}));

test('generated manifests resolve from their own directory, sort files and preserve existing reviews', () => fixture(async ({ dir, write }) => {
  await write('downloads/z.png', 'z');
  await write('downloads/a.png', 'a');
  await fs.mkdir(path.join(dir, 'downloads', 'folder.jpg'));
  const output = path.join(dir, 'metadata', 'images.json');
  const result = await manifest(path.join(dir, 'downloads'), output);
  assert.deepEqual(result.images.map((entry) => entry.path), ['../downloads/a.png', '../downloads/z.png']);
  for (const entry of result.images) assert.ok((await fs.stat(path.resolve(path.dirname(output), entry.path))).isFile());
  const before = await fs.readFile(output, 'utf8');
  await assert.rejects(manifest(path.join(dir, 'downloads'), output), /未覆盖/);
  assert.equal(await fs.readFile(output, 'utf8'), before);
}));

test('only images actually used need delivery approval; client assets with documented rights work', () => fixture(async ({ write }) => {
  await write('assets/a & b.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
  const html = await write('design.html', page('<img src="assets/a%20%26%20b.svg"><h1>开放日</h1>'));
  const images = await write('metadata/images.json', { images: [
    { id: 'used', path: '../assets/a & b.svg', role: 'cover', status: 'approved', sourceType: 'client_supplied', rights: 'Project owner authorized this test asset.' },
    { id: 'unused', path: 'missing-preview.png', role: 'detail', status: 'preview', sourceType: 'unknown' }
  ] });
  assert.equal((await check({ html, images })).pass, true);
}));

test('CSS and responsive image references are checked while font URLs are not image entries', () => fixture(async ({ write }) => {
  const html = await write('design.html', `<style>@font-face{font-family:Local;src:url(font.woff2)}.photo{background:url('background.png')}</style>${page('<img src="one.png" srcset="two.png 2x"><img srcset="three.png 1x">')}`);
  const report = await check({ html });
  assert.equal(report.referencedImages, 4);
  assert.equal(report.errors.filter((issue) => issue.code === 'IMAGE_FILE_MISSING').length, 4);
  assert.ok(!codes(report).includes('IMAGE_NOT_LOCAL'));
}));

test('numeric entities are scanned; draft and delivery differ for missing facts', () => fixture(async ({ write }) => {
  const html = await write('design.html', page('<p>&#x6210;&#x672c; 30</p><p>【待确认日期】</p>'));
  const delivery = await check({ html });
  assert.ok(codes(delivery).includes('INTERNAL_FIELD_LEAK'));
  assert.ok(codes(delivery).includes('PENDING_FACT'));
  const draft = await check({ html, mode: 'draft' });
  assert.ok(draft.warnings.some((issue) => issue.code === 'PENDING_FACT'));
}));

test('an official source label without approval evidence is insufficient', () => fixture(async ({ write }) => {
  await write('photo.jpg', 'test');
  const html = await write('design.html', page('<img src="photo.jpg">'));
  const images = await write('images.json', { images: [{ id: 'a', path: 'photo.jpg', role: 'cover', status: 'approved', sourceType: 'official_web' }] });
  const report = await check({ html, images });
  assert.ok(codes(report).includes('IMAGE_RIGHTS_MISSING'));
  assert.ok(codes(report).includes('IMAGE_SOURCE_MISSING'));
}));

test('malformed manifests are not interpreted as an empty approved collection', () => fixture(async ({ write }) => {
  const images = await write('images.json', {});
  assert.ok(codes(await check({ images })).includes('IMAGE_MANIFEST_SHAPE'));
}));

test('illustration provenance does not allow a generated image to become documentary evidence', () => fixture(async ({ write }) => {
  await write('image.svg', '<svg/>');
  const images = await write('images.json', { images: [{ id: 'a', path: 'image.svg', role: 'cover', status: 'approved', sourceType: 'ai_generated', rights: 'Generated for this project', usage: 'documentary' }] });
  assert.ok(codes(await check({ images })).includes('GENERATED_IMAGE_USAGE'));
}));

test('image suggestions do not force a six-page plan', () => fixture(async ({ write }) => {
  const product = await write('product.json', { name: '开放日', description: '活动介绍' });
  assert.equal((await analyze(product)).pageCount, null);
  const plan = await write('plan.json', { pageCount: 1 });
  assert.equal((await analyze(product, plan)).pageCount, 1);
}));

test('CLI rejects a missing option value and unknown commands', () => {
  const a = spawnSync(process.execPath, [path.join(root, 'scripts/check.mjs'), '--html'], { encoding: 'utf8' });
  assert.equal(a.status, 1);
  assert.match(a.stderr, /需要一个值/);
  const b = spawnSync(process.execPath, [path.join(root, 'scripts/image-workflow.mjs'), 'typo'], { encoding: 'utf8' });
  assert.equal(b.status, 1);
});

test('PPTX refuses unsupported pages without creating a partial file', () => fixture(async ({ write, dir }) => {
  const html = await write('brochure.html', '<section class="page page-cover"><h1 class="cover-title">封面</h1></section><section class="page custom">自定义</section>');
  const output = path.join(dir, 'out.pptx');
  await assert.rejects(htmlToPptx(html, output), /第 2 页/);
  await assert.rejects(fs.stat(output), { code: 'ENOENT' });
}));

test('PPTX refuses to truncate a ninth itinerary entry', () => fixture(async ({ write, dir }) => {
  const html = await write('brochure.html', `<section class="page page-timeline">${'<div class="tl-item">活动</div>'.repeat(9)}</section>`);
  await assert.rejects(htmlToPptx(html, path.join(dir, 'out.pptx')), /超过 8 项/);
}));

let JSZip;
try {
  const require = createRequire(import.meta.url);
  JSZip = createRequire(require.resolve('pptxgenjs'))('jszip');
} catch { /* The core suite works without optional PPTX dependencies. */ }

test('PPTX preserves nested lists, itinerary, specifications and single-quoted reordered classes', { skip: !JSZip }, () => fixture(async ({ write, dir }) => {
  const html = await write('brochure.html', `<section id='intro' class='page-split photo-right page'>
    <h2 class='page-title'>三项活动</h2><div class='num-item'><div class='num'>01</div><div><h3>结构工坊</h3><p>搭建机器人 &amp; 调试</p></div></div>
    <div class='footer'><span>测试品牌</span><span>01</span></div></section>
    <section class='page page-timeline'><h2 class='page-title'>行程</h2><div class='tl-item'><div class='tl-time'>09:00</div><div class='tl-title'>参观校园</div><div class='tl-desc'>认识实验室</div></div></section>
    <section class='page page-specs'><dl class='spec-grid'><div class='spec'><dt>时长</dt><dd>半日</dd></div></dl></section>`);
  const output = path.join(dir, 'out.pptx');
  const result = await htmlToPptx(html, output);
  assert.equal(result.slides, 3);
  const zip = await JSZip.loadAsync(await fs.readFile(output));
  const files = Object.keys(zip.files).filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file));
  assert.equal(files.length, 3);
  const xml = (await Promise.all(files.map((file) => zip.file(file).async('string')))).join('\n');
  for (const text of ['结构工坊', '搭建机器人 &amp; 调试', '测试品牌', '09:00', '参观校园', '认识实验室', '时长', '半日']) assert.ok(xml.includes(text), `Missing ${text}`);
}));
