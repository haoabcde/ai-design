import fs from 'node:fs/promises';
import path from 'node:path';
import { readData, parseArgs, requireArgs, isMain } from './lib/utils.mjs';

export async function analyze(productPath, planPath) {
  const product = await readData(path.resolve(productPath));
  const plan = planPath ? await readData(path.resolve(planPath)) : null;
  const recommended = [{ role: 'cover', purpose: '主视觉（可选；文字主导设计可以不用图片）', aspect: 'match-layout', minWidth: 2400 }];
  if (product.modules?.length || product.benefits?.length) recommended.push({ role: 'detail', purpose: '解释产品或细节', aspect: 'match-layout', minWidth: 1800 });
  if (product.itinerary?.length) recommended.push({ role: 'context', purpose: '与实际场景相符的照片', aspect: 'match-layout', minWidth: 1800 });
  return { recommended, totalRecommended: recommended.length, pageCount: plan?.pageCount ?? null, note: '数量与尺寸是搜图建议；先看内容和栏位，不为凑页数配图。' };
}

export async function sourcePlan(productPath) {
  const product = await readData(path.resolve(productPath));
  const name = product.name || '产品';
  return {
    preferredSources: [
      { priority: 1, type: 'client_supplied', searchHint: '检查客户或项目已有素材，记录授权范围' },
      { priority: 2, type: 'official_wechat', searchHint: `查找“${name}”官方公众号的相关原始图片` },
      { priority: 3, type: 'official_web', searchHint: `查找“${name} 官网”的图库、新闻或媒体资料` },
      { priority: 4, type: 'licensed', searchHint: `查找与“${product.category || name}”相符的授权素材，记录具体许可` }
    ],
    note: '官方公开发布不等于允许转载或商用；保留来源 URL 和许可依据，不裁掉水印冒充已获授权。生成图可作说明性视觉，不冒充真实场景。',
    qualityRules: { minWidthRecommended: 1800, avoid: ['watermark', 'low resolution', 'unrelated subject', 'stretched crops'] }
  };
}

export async function manifest(downloadDir, outputPath) {
  const directory = path.resolve(downloadDir);
  const output = path.resolve(outputPath);
  const files = (await fs.readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp|svg)$/i.test(entry.name)).map((entry) => entry.name).sort();
  const images = files.map((file, index) => ({
    id: `img-${String(index + 1).padStart(3, '0')}`,
    path: path.relative(path.dirname(output), path.join(directory, file)).split(path.sep).join('/'),
    role: 'unassigned', status: 'preview', sourceType: 'unknown', sourceUrl: '', rights: ''
  }));
  const result = { images };
  await fs.mkdir(path.dirname(output), { recursive: true });
  try { await fs.writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' }); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`清单已存在，未覆盖审核记录：${output}；请使用新的 --output 路径`);
    throw error;
  }
  return result;
}

if (isMain(import.meta.url)) {
  try {
    const [command, ...rest] = process.argv.slice(2);
    if (!command || command === '--help') console.log('用法: image-workflow.mjs analyze|source-plan --product product.json [--plan page-plan.json]\n      image-workflow.mjs manifest --download-dir downloads --output images.json');
    else {
      const options = {
        analyze: { values: ['product', 'plan'], required: ['product'] },
        'source-plan': { values: ['product'], required: ['product'] },
        manifest: { values: ['download-dir', 'output'], required: ['download-dir', 'output'] }
      }[command];
      if (!options) throw new Error(`不认识的命令：${command}`);
      const args = parseArgs(rest, options);
      requireArgs(args, options.required);
      const result = command === 'analyze' ? await analyze(args.product, args.plan)
        : command === 'source-plan' ? await sourcePlan(args.product)
        : await manifest(args['download-dir'], args.output);
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
