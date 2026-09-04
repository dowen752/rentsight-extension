import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const extensionBuildDirectory = resolve(projectRoot, 'dist');
const authBuildDirectory = resolve(projectRoot, 'dist-auth');
const authHostSource = resolve(extensionBuildDirectory, 'auth-host.html');
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

await rm(authBuildDirectory, { force: true, recursive: true });
await mkdir(dirname(authHostDestination), { recursive: true });
await cp(authHostSource, authHostDestination);

for (const referencedPath of new Set(referencedPaths)) {
  const relativePath = referencedPath.slice(1);
  const source = resolve(extensionBuildDirectory, relativePath);
  const destination = resolve(authBuildDirectory, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
}

console.info(
  `Prepared ${1 + new Set(referencedPaths).size} auth-host assets in dist-auth.`,
);
