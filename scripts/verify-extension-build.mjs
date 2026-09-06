import { Script } from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';

const EXPECTED_EXTENSION_ID = 'pkcmgccphdnmmdjhipgiohmolkailema';

const contentScript = await readFile(
  new URL('../dist/content.js', import.meta.url),
  'utf8',
);

try {
  new Script(contentScript, { filename: 'dist/content.js' });
} catch (cause) {
  throw new Error(
    'dist/content.js must parse as a classic Chrome content script, without module imports or exports.',
    { cause },
  );
}

const manifest = JSON.parse(
  await readFile(new URL('../dist/manifest.json', import.meta.url), 'utf8'),
);
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
