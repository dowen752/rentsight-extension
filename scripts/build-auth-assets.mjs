import { mkdir, readFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const authBuildDirectory = resolve(projectRoot, 'dist-auth');
const authHostSource = resolve(authBuildDirectory, 'auth-host.html');
const authHostDestination = resolve(
  authBuildDirectory,
  'rentsight/auth-host.html',
);

const html = await readFile(authHostSource, 'utf8');
const referencedPaths = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(
  (match) => match[1],
);

if (!referencedPaths.includes('/authHost.js')) {
  throw new Error('The auth-host build does not reference /authHost.js.');
}

await mkdir(dirname(authHostDestination), { recursive: true });
await rename(authHostSource, authHostDestination);

for (const referencedPath of new Set(referencedPaths)) {
  await readFile(resolve(authBuildDirectory, referencedPath.slice(1)));
}

console.info(
  `Prepared and verified ${1 + new Set(referencedPaths).size} independently built auth-host assets in dist-auth.`,
);
