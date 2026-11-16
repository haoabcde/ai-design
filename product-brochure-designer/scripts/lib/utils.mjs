import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const INTERNAL_KEY = /(?:成本|分销|渠道|结算|利润|内部|底价|supplier|margin|cost|wholesale|internal)/i;
export const REQUIRED_FACTS = ['name', 'description'];

export function parseArgs(argv, { values = [], flags = [] } = {}) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`不认识的参数：${key}`);
    const name = key.slice(2);
    if (flags.includes(name)) { args[name] = true; continue; }
    if (!values.includes(name)) throw new Error(`不认识的参数：${key}`);
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`${key} 需要一个值`);
    args[name] = argv[++i];
  }
  return args;
}

export function requireArgs(args, names) {
  for (const name of names) if (!args[name]) throw new Error(`缺少参数 --${name}`);
}

export const isMain = (url) => Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(url);

export function localAssetPath(reference, directory) {
  if (!reference || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(reference)) return null;
  const filename = decodeURIComponent(reference.split(/[?#]/)[0]);
  return filename ? path.resolve(directory, filename) : null;
}

export async function readData(file) {
  const raw = await fs.readFile(file, 'utf8');
  if (!/\.ya?ml$/i.test(file)) return JSON.parse(raw);
  let YAML;
  try { YAML = (await import('yaml')).default; } catch {
    throw new Error(`读取 YAML 需要可选依赖 yaml：请先运行 pnpm install，或改用 JSON 格式的输入文件（${file}）`);
  }
  return YAML.parse(raw);
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function safeName(value) {
  return String(value || 'product').replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').slice(0, 80) || 'product';
}

export function clip(value, length = 150) {
  const text = String(value || '').trim();
  return text.length <= length ? text : `${text.slice(0, Math.max(0, length - 1)).trim()}…`;
}

export async function exists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}
