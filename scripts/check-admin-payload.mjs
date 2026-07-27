/* ------------------------------------------------------------------
   Admin payload gate (v0.4.2). Runs on every build, in CI too.

   The failure this exists to catch is silent and nasty: edit the admin
   dashboard, forget to re-encrypt, ship. The site then serves a gate that
   unlocks into the PREVIOUS dashboard, with no error anywhere, because the
   old ciphertext decrypts perfectly well. It just is not what the repo
   says it is. Same family as the two mesh gates: prove the shipped artifact
   matches its source, or refuse to build.

   It needs no password, because it compares a hash of the plaintext sources
   that the encryptor publishes in the clear.
   ------------------------------------------------------------------ */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sourceHashOf } from './admin-payload-hash.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const payloadPath = path.join(root, 'public/admin-payload.json');

const fail = (message) => {
  console.error(`\nAdmin payload check FAILED.\n  ${message}\n`);
  console.error('  Fix: BSS_ADMIN_PASSWORD=... node scripts/build-admin-payload.mjs\n');
  process.exit(1);
};

let payload;
try {
  payload = JSON.parse(await fs.readFile(payloadPath, 'utf8'));
} catch {
  fail('public/admin-payload.json is missing or is not valid JSON.');
}

for (const field of ['salt', 'iv', 'ciphertext', 'sourceHash', 'iterations']) {
  if (!payload[field]) fail(`public/admin-payload.json has no "${field}".`);
}

if (payload.iterations < 300000) {
  fail(`iterations is ${payload.iterations}, below the 300000 floor this repo holds.`);
}

const html = await fs.readFile(path.join(root, 'src/admin/dashboard.html'), 'utf8');
const code = await fs.readFile(path.join(root, 'src/admin/dashboard.js'), 'utf8');
const expected = sourceHashOf(html, code);

if (payload.sourceHash !== expected) {
  fail(
    'the encrypted payload is STALE: src/admin/dashboard.{html,js} have changed\n' +
      '  since it was generated, so the shipped admin would unlock into the old build.',
  );
}

console.log(`Admin payload OK (${payload.iterations} iterations, source hash matches).`);
