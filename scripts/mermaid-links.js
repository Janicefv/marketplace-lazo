// Genera los enlaces de acceso a cada diagrama en el editor de mermaid.ai.
// Uso: node scripts/mermaid-links.js   (lee docs/arquitectura/*.mmd)
import { readdir, readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const DIR = new URL('../docs/arquitectura/', import.meta.url);

// Mismo formato que usa el editor de Mermaid: JSON -> deflate (zlib) -> base64url, con prefijo "pako:".
function pako(code) {
  const state = { code, mermaid: JSON.stringify({ theme: 'default' }, null, 2), autoSync: true, rough: false, updateDiagram: true, panZoom: true };
  return `pako:${deflateSync(Buffer.from(JSON.stringify(state)), { level: 9 }).toString('base64url')}`;
}

for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.mmd')).sort()) {
  const hash = pako(await readFile(new URL(file, DIR), 'utf8'));
  console.log(`${file}\n  editar: https://mermaid.ai/live/edit#${hash}\n  ver:    https://mermaid.ai/live/view#${hash}\n`);
}
