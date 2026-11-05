// Controlla che ogni frase passata a t('…') abbia la traduzione in src/lib/en.ts.
// Uso: npm run check:i18n
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && files.push(p); });
walk('src');

const en = readFileSync('src/lib/en.ts', 'utf8');
const keys = new Set();
for (const m of en.matchAll(/^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:/gm)) keys.add(m[2].replace(/\\(.)/g, '$1'));

const missing = new Map();
const re = /(?<![\w.$])t\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(re)) {
    if (m[1] === '`' && m[2].includes('${')) continue; // frase costruita al volo: usa {variabili}
    const k = m[2].replace(/\\(.)/g, '$1');
    if (!keys.has(k)) missing.set(k, f);
  }
}
if (missing.size) {
  console.log(`Frasi senza traduzione inglese (${missing.size}):`);
  for (const [k, f] of missing) console.log(`  ${f}: ${JSON.stringify(k)}`);
  process.exit(1);
}
console.log('Tutte le frasi hanno la traduzione inglese.');
