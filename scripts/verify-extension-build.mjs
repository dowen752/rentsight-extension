import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { Script } from 'node:vm';

const EXPECTED_EXTENSION_ID = 'pkcmgccphdnmmdjhipgiohmolkailema';
const projectRoot = resolve(import.meta.dirname, '..');
const extensionBuildDirectory = resolve(projectRoot, 'dist');
const authBuildDirectory = resolve(projectRoot, 'dist-auth');

const REMOTE_SCRIPT_LOADERS = [
  'apis.google.com/js/api.js',
  'recaptcha/api.js',
  'recaptcha/enterprise.js',
];

const toBuildPath = (buildDirectory, absolutePath) =>
  relative(buildDirectory, absolutePath).split(sep).join('/');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return files.flat();
}

async function requireBuildFile(buildDirectory, path, source) {
  const cleanPath = path.split(/[?#]/, 1)[0];
  const absolutePath = cleanPath.startsWith('/')
    ? resolve(buildDirectory, cleanPath.slice(1))
    : resolve(dirname(source), cleanPath);
  const buildPrefix = `${buildDirectory}${sep}`;
  if (!absolutePath.startsWith(buildPrefix)) {
    throw new Error(
      `${toBuildPath(buildDirectory, source)} references a path outside its build: ${path}`,
    );
  }
  try {
    await access(absolutePath);
  } catch (cause) {
    throw new Error(
      `${toBuildPath(buildDirectory, source)} references missing build asset ${path}.`,
      { cause },
    );
  }
}

async function verifyHtmlReferences(buildDirectory, htmlPath, options = {}) {
  const html = await readFile(htmlPath, 'utf8');
  const references = [...html.matchAll(/(?:src|href)=(['"])([^'"]+)\1/g)].map(
    (match) => match[2],
  );

  for (const reference of references) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(reference)) continue;
    if (options.requireRootRelative && !reference.startsWith('/')) {
      throw new Error(
        `${toBuildPath(buildDirectory, htmlPath)} must use root-relative hosted asset URLs; found ${reference}.`,
      );
    }
    await requireBuildFile(buildDirectory, reference, htmlPath);
  }
  return references;
}

async function verifyJavaScriptImports(buildDirectory, javascriptPaths) {
  for (const javascriptPath of javascriptPaths) {
    const source = await readFile(javascriptPath, 'utf8');
    const imports = [
      ...source.matchAll(
        /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)(['"])([^'"]+)\1/g,
      ),
    ].map((match) => match[2]);
    for (const importedPath of imports) {
      if (!importedPath.startsWith('.') && !importedPath.startsWith('/'))
        continue;
      await requireBuildFile(buildDirectory, importedPath, javascriptPath);
    }
  }
}

const extensionFiles = await listFiles(extensionBuildDirectory);
const extensionBuildPaths = extensionFiles.map((path) =>
  toBuildPath(extensionBuildDirectory, path),
);
const hostedAuthFiles = extensionBuildPaths.filter((path) => {
  const name = basename(path);
  return (
    name.toLowerCase() === 'auth-host.html' ||
    /^authhost(?:-[^.]+)?\.js$/i.test(name)
  );
});
if (hostedAuthFiles.length) {
  throw new Error(
    `Hosted authentication files must not be packaged in dist/: ${hostedAuthFiles.join(', ')}`,
  );
}

const extensionJavaScript = extensionFiles.filter((path) =>
  path.endsWith('.js'),
);
if (!extensionJavaScript.length) {
  throw new Error('The extension build did not emit any JavaScript.');
}

for (const javascriptPath of extensionJavaScript) {
  const source = await readFile(javascriptPath, 'utf8');
  for (const loader of REMOTE_SCRIPT_LOADERS) {
    if (source.includes(loader)) {
      throw new Error(
        `${toBuildPath(extensionBuildDirectory, javascriptPath)} contains forbidden remote script loader ${loader}.`,
      );
    }
  }
}
await verifyJavaScriptImports(extensionBuildDirectory, extensionJavaScript);

const requiredExtensionFiles = [
  'manifest.json',
  'background.js',
  'content.js',
  'offscreen.html',
  'sidepanel.html',
];
for (const path of requiredExtensionFiles) {
  await requireBuildFile(
    extensionBuildDirectory,
    `/${path}`,
    resolve(extensionBuildDirectory, 'manifest.json'),
  );
}

for (const htmlPath of extensionFiles.filter((path) =>
  path.endsWith('.html'),
)) {
  await verifyHtmlReferences(extensionBuildDirectory, htmlPath);
}

const contentScriptPath = resolve(extensionBuildDirectory, 'content.js');
const contentScript = await readFile(contentScriptPath, 'utf8');

try {
  new Script(contentScript, { filename: 'dist/content.js' });
} catch (cause) {
  throw new Error(
    'dist/content.js must parse as a classic Chrome content script, without module imports or exports.',
    { cause },
  );
}

const manifestPath = resolve(extensionBuildDirectory, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const packageMetadata = JSON.parse(
  await readFile(resolve(projectRoot, 'package.json'), 'utf8'),
);
if (manifest.version !== packageMetadata.version) {
  throw new Error(
    `dist/manifest.json version ${manifest.version} does not match package.json version ${packageMetadata.version}.`,
  );
}
const manifestEntryPoints = [
  manifest.background?.service_worker,
  manifest.side_panel?.default_path,
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
].filter((path) => typeof path === 'string');
for (const path of new Set(manifestEntryPoints)) {
  await requireBuildFile(extensionBuildDirectory, `/${path}`, manifestPath);
}

const extensionId = [
  ...createHash('sha256')
    .update(Buffer.from(String(manifest.key ?? ''), 'base64'))
    .digest('hex')
    .slice(0, 32),
]
  .map((nibble) => 'abcdefghijklmnop'[Number.parseInt(nibble, 16)])
  .join('');

if (extensionId !== EXPECTED_EXTENSION_ID) {
  throw new Error(
    `dist/manifest.json resolves to extension ID ${extensionId}, expected ${EXPECTED_EXTENSION_ID}.`,
  );
}

const authFiles = await listFiles(authBuildDirectory);
const authBuildPaths = authFiles.map((path) =>
  toBuildPath(authBuildDirectory, path),
);
const expectedAuthHtml = 'rentsight/auth-host.html';
const authHtmlFiles = authBuildPaths.filter((path) => path.endsWith('.html'));
if (
  authHtmlFiles.length !== 1 ||
  authHtmlFiles[0] !== expectedAuthHtml ||
  authBuildPaths.includes('auth-host.html')
) {
  throw new Error(
    `dist-auth must contain exactly ${expectedAuthHtml}; found ${authHtmlFiles.join(', ') || 'no HTML files'}.`,
  );
}

const extensionOnlyAuthFiles = [
  'manifest.json',
  'background.js',
  'content.js',
  'offscreen.html',
  'offscreen.js',
  'sidepanel.html',
  'sidepanel.js',
].filter((path) => authBuildPaths.includes(path));
if (extensionOnlyAuthFiles.length) {
  throw new Error(
    `Extension package files must not be copied into dist-auth/: ${extensionOnlyAuthFiles.join(', ')}`,
  );
}

const authHtmlPath = resolve(authBuildDirectory, expectedAuthHtml);
const authReferences = await verifyHtmlReferences(
  authBuildDirectory,
  authHtmlPath,
  { requireRootRelative: true },
);
if (!authReferences.includes('/authHost.js')) {
  throw new Error(`${expectedAuthHtml} does not load /authHost.js.`);
}
const authJavaScript = authFiles.filter((path) => path.endsWith('.js'));
if (!authJavaScript.length) {
  throw new Error(
    'The hosted authentication build did not emit any JavaScript.',
  );
}
await verifyJavaScriptImports(authBuildDirectory, authJavaScript);

console.info(
  `Verified ${extensionJavaScript.length} extension JavaScript files, ${manifestEntryPoints.length} manifest entry references, and ${authFiles.length} hosted-auth assets.`,
);
