/* ------------------------------------------------------------------
   Admin password checker (v0.5.6, user call).

   Answers one question and only one: does this password open the payload
   that is currently in the repo? It is READ ONLY. It writes nothing,
   touches no file, and cannot damage anything it is pointed at.

   WHY IT EXISTS. The password is the key, not an answer checked against
   a stored copy, so there is nothing anywhere in this repo to compare a
   candidate to (§ rule 8, and the header of build-admin-payload.mjs).
   That is the right design and it has one sharp edge: re-encrypting with
   a password you MISREMEMBERED is silent and expensive. The payload would
   decrypt for the wrong secret, the build gate would pass (it hashes the
   sources, not the key), and the damage would only show up on the
   deployed admin, which would open on the wrong password and then fail to
   reach Firestore, because the same secret is the Firebase account's.

   The shipped payload is the oracle that avoids all of that: it was made
   with the real password, so trying a candidate against it is free, exact
   and offline. Check first, then encrypt.

   It is deliberately NOT wired into `npm run build`. The build gate proves
   the ciphertext matches the sources and needs no password at all, which
   is what lets it run in CI; this needs the secret, so it stays a thing a
   person runs on purpose.

   USAGE
     BSS_ADMIN_PASSWORD='...' npm run admin:check
   Exit 0 means the password opens it, 1 means it does not, 2 means it was
   not asked properly.

   The candidate arrives in an env var and is used once, in memory. Nothing
   secret is ever printed: the check reports yes or no, and the admin
   address is masked, because the whole point of putting that address
   inside the ciphertext (v0.4.8) was to keep it out of a public repo, and
   printing it here would hand it to anyone reading over a shoulder.
   ------------------------------------------------------------------ */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto as crypto } from 'node:crypto';

/* Must match src/admin.js and scripts/build-admin-payload.mjs byte for byte.
   If these three ever disagree, every password on earth is wrong here. */
const KDF_PREFIX = 'bss-admin:';
const AAD = 'bss-admin:v1';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(root, 'public/admin-payload.json');

const password = process.env.BSS_ADMIN_PASSWORD || '';
if (!password) {
  console.error("BSS_ADMIN_PASSWORD is required.\n  BSS_ADMIN_PASSWORD='...' npm run admin:check");
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(await fs.readFile(target, 'utf8'));
} catch {
  console.error(`Could not read a payload at ${path.relative(root, target) || target}.`);
  process.exit(2);
}

const encoder = new TextEncoder();
const bytes = (base64) => Uint8Array.from(Buffer.from(base64 || '', 'base64'));

/* First and last character kept, everything between them gone. Enough to
   recognise an address you already know, useless to anyone who does not. */
const mask = (value) => {
  const [name = '', host = ''] = String(value).split('@');
  const squash = (s) => (s.length <= 2 ? '*'.repeat(s.length) : `${s[0]}***${s[s.length - 1]}`);
  if (!host) return squash(name);
  const dot = host.lastIndexOf('.');
  return `${squash(name)}@${squash(host.slice(0, dot))}${host.slice(dot)}`;
};

const material = await crypto.subtle.importKey(
  'raw',
  encoder.encode(KDF_PREFIX + password),
  'PBKDF2',
  false,
  ['deriveKey'],
);
const key = await crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: bytes(payload.salt),
    iterations: Number(payload.iterations) || 600000,
  },
  material,
  { name: 'AES-GCM', length: 256 },
  false,
  ['decrypt'],
);

try {
  /* A wrong password fails the GCM authentication tag and throws here. That
     is the entire test: there is no comparison and no branch to get wrong. */
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(payload.iv), additionalData: encoder.encode(AAD) },
    key,
    bytes(payload.ciphertext),
  );
  const data = JSON.parse(new TextDecoder().decode(plain));

  /* Whether the ciphertext is CURRENT is a different question from whether
     the password is right, and answering both here is what makes this
     useful before a push: a stale payload opens perfectly. */
  const html = await fs.readFile(path.join(root, 'src/admin/dashboard.html'), 'utf8');
  const code = await fs.readFile(path.join(root, 'src/admin/dashboard.js'), 'utf8');
  const fresh = data.html === html && data.code === code;

  console.log('Password OK. This payload opens with it.');
  console.log(`  admin address   : ${mask(data.adminEmail || '')}`);
  console.log(`  generated       : ${data.generatedAt || 'unknown'}`);
  console.log(`  iterations      : ${payload.iterations}`);
  console.log(
    `  dashboard       : ${fresh ? 'matches the current source' : 'STALE, re-run npm run admin:payload'}`,
  );
  process.exit(0);
} catch {
  console.log('Password does NOT open this payload. Nothing was changed.');
  console.log('  Do not re-encrypt with it: that would silently move the admin onto the wrong secret.');
  process.exit(1);
}
