// Publica la beta (beta.agram.ikisai.com) directamente desde este disco a Cloudflare Pages, sin pasar por GitHub.
//
//   node beta/publicar.mjs                 publica el árbol de trabajo tal como está (sin commit)
//   node beta/publicar.mjs --config ruta   el archivo con api_token, account_id (y zone_id) de Cloudflare
//
// El archivo de credenciales NO está en el repositorio: por defecto se busca en
// ../PROD/ikisai-apps/private/cloudflare.json (relativo a la raíz del repositorio) o en la variable de entorno
// AGRAM_CLOUDFLARE_CONFIG. Nunca se imprime ni se copia.
//
// Qué publica: lo mismo que sirve GitHub Pages (la raíz del repositorio) salvo lo que no es la web (.git, node_modules,
// test, bench, .github, servidor, beta). Dos diferencias a propósito, solo en la beta: el service worker se sustituye
// por uno que se da de baja y borra sus cachés (la beta cambia a cada rato y no debe cachear), y un archivo _headers
// pide al navegador que no cachee html, js, css ni json. Así cada recarga en el móvil enseña el último retoque.

import { cpSync, mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROYECTO = 'agram-beta';
const RAMA = 'beta';
const EXCLUIR = new Set(['.git', 'node_modules', 'test', 'bench', '.github', 'servidor', 'beta', '.playwright-mcp', '.wrangler']);

const args = process.argv.slice(2);
const iConfig = args.indexOf('--config');
const rutaConfig = iConfig >= 0 ? args[iConfig + 1] : process.env.AGRAM_CLOUDFLARE_CONFIG || resolve(RAIZ, '..', 'PROD', 'ikisai-apps', 'private', 'cloudflare.json');
if (!existsSync(rutaConfig)) {
  console.error('No encuentro las credenciales de Cloudflare en ' + rutaConfig + ' (usa --config o AGRAM_CLOUDFLARE_CONFIG).');
  process.exit(1);
}
const config = JSON.parse(readFileSync(rutaConfig, 'utf8'));
if (!config.api_token || !config.account_id) {
  console.error('El archivo de credenciales necesita api_token y account_id.');
  process.exit(1);
}

const SW_BETA = `// Service worker de la beta: se da de baja y borra las cachés de la carta, para que cada recarga vaya a la red.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
  })());
});
`;
const HEADERS = `/*
  Cache-Control: no-cache
`;

const escenario = mkdtempSync(join(tmpdir(), 'agram-beta-'));
try {
  cpSync(RAIZ, escenario, {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(RAIZ.length).replace(/^[\\/]/, '').split(/[\\/]/)[0];
      return !EXCLUIR.has(rel);
    },
  });
  writeFileSync(join(escenario, 'sw.js'), SW_BETA);
  writeFileSync(join(escenario, '_headers'), HEADERS);
  const r = spawnSync('npx', ['--yes', 'wrangler@4', 'pages', 'deploy', escenario, '--project-name', PROYECTO, '--branch', RAMA, '--commit-dirty=true'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, CLOUDFLARE_API_TOKEN: config.api_token, CLOUDFLARE_ACCOUNT_ID: config.account_id },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log('\nBeta publicada: https://beta.agram.ikisai.com/');
} finally {
  rmSync(escenario, { recursive: true, force: true });
}
