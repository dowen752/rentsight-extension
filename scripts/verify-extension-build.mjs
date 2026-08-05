import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const contentScript = await readFile(
  new URL('../dist/content.js', import.meta.url),
  'utf8',
);

if (/^\s*import\s/m.test(contentScript)) {
  throw new Error(
    'dist/content.js contains an ES module import and cannot be injected as a classic Chrome content script.',
  );
}
