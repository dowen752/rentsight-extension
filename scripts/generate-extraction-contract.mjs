import { readFile, writeFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import standalone from 'ajv/dist/standalone/index.js';
import { compile } from 'json-schema-to-typescript';

const directory = new URL('../src/ai/contracts/', import.meta.url);
for (const name of ['request', 'response']) {
  const schema = JSON.parse(
    await readFile(new URL(`${name}.schema.json`, directory), 'utf8'),
  );
  const ajv = new Ajv2020({
    code: { source: true, esm: true },
    strict: false,
    unicode: false,
  });
  ajv.addFormat(
    'uuid',
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  ajv.addFormat('date-time', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  ajv.addFormat('uri', /^https?:\/\/[^\s]+$/);
  const validate = ajv.compile(schema);
  // Precompiled validators work under Manifest V3 without eval/new Function.
  await writeFile(
    new URL(`${name}.validator.js`, directory),
    standalone(ajv, validate),
  );
  await writeFile(
    new URL(`${name}.validator.d.ts`, directory),
    'export default function validate(value: unknown): boolean;\n',
  );
  await writeFile(
    new URL(`${name}.ts`, directory),
    await compile(
      schema,
      name === 'request' ? 'ExtractionRequest' : 'ExtractionResponse',
      {
        bannerComment:
          '/* Generated from the shared v1 JSON schema. Run npm run contract:generate. */',
      },
    ),
  );
}
