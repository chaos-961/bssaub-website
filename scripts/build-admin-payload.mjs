/* ------------------------------------------------------------------
   Admin payload encryptor (v0.4.2).

   Encrypts the admin dashboard (its markup AND its code) into
   public/admin-payload.json with AES-256-GCM under a key derived from the
   admin password by PBKDF2-SHA-256.

   WHY ENCRYPT THE DASHBOARD INSTEAD OF CHECKING A PASSWORD.
   This is a static site. There is no server to ask, so any gate of the
   shape `if (typed === SECRET)` ships the answer to everyone who opens
   devtools, and even a HASHED comparison only moves the problem: the
   attacker skips the check and reads the markup that was sitting in the
   bundle the whole time. Encryption removes the thing being guarded
   rather than guarding it. Without the password the payload is bytes; the
   password IS the key, so there is nothing to compare, nothing to patch
   out, and no code path that can be stepped over.

   WHAT THIS DOES NOT DO. It does not make the admin password a strong
   secret. AES-GCM is not the weak link and PBKDF2 at 600k iterations is
   the OWASP figure for SHA-256, but the ceiling is the password's own
   entropy, because an attacker holding the file can grind candidates
   offline at their own pace. A 9 character password buys hours to days
   against a motivated GPU. That is a known, accepted state (the plan is a
   16 character password, at which point offline grinding stops being a
   strategy), and it is exactly why nothing sensitive should live in this
   payload until the longer password lands, and why a real backend must
   authenticate against its own rules rather than trust this gate.

   THE PASSWORD NEVER TOUCHES THE REPO. It arrives in BSS_ADMIN_PASSWORD
   and is used once, here. Only salt, iv and ciphertext are written out.

   BSS_ADMIN_EMAIL, ADDED AT v0.4.8, AND WHY IT IS ENCRYPTED RATHER THAN
   A CONSTANT. The admin now writes to Firestore, and Firestore can only
   answer to a Firebase identity, so the gate has to sign in to a real
   account. The address of that account goes INSIDE the ciphertext: it is
   not much of a secret (Firebase's enumeration protection means nobody
   can confirm a guess, and its own rate limits stand behind that), but
   naming the exact account to attack in a public repo is free to avoid,
   and here the cost of avoiding it is one env var.

   THE ADMIN PASSWORD IS NOW ALSO THAT ACCOUNT'S FIREBASE PASSWORD, one
   secret doing both jobs so the operator types one thing. That raises
   what a cracked payload is worth, from "the dashboard markup" to "write
   access to the members collection", and it is the reason the password
   length note above stopped being theoretical. Use a long one.

   USAGE
     BSS_ADMIN_PASSWORD='...' BSS_ADMIN_EMAIL='...' node scripts/build-admin-payload.mjs
   Re-run it after ANY edit to src/admin/dashboard.html or dashboard.js.
   scripts/check-admin-payload.mjs runs on every build and fails loudly if
   you forget (it compares a source hash, so it needs no password). Note
   that the gate cannot catch a changed EMAIL, since the address is not
   part of the source hash; changing it is a deliberate re-run.
   ------------------------------------------------------------------ */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sourceHashOf } from './admin-payload-hash.mjs';

/* Domain separation for the derived key, as a plain visible constant. The
   textbook form joins prefix and password with a NUL byte, which is also
   completely invisible in a diff, and the browser side has to reproduce this
   string EXACTLY or every password on earth is wrong. A fixed literal prefix
   is just as unambiguous here (the password is the only variable part) and it
   can be read. src/admin.js carries the same two constants. */
const KDF_PREFIX = 'bss-admin:';
const AAD = 'bss-admin:v1';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const password = process.env.BSS_ADMIN_PASSWORD || '';
const adminEmail = (process.env.BSS_ADMIN_EMAIL || '').trim();
const iterations = Number(process.env.BSS_ADMIN_ITERATIONS || 600000);
const lockAfterMinutes = Number(process.env.BSS_ADMIN_LOCK_MINUTES || 15);
const MIN_PASSWORD = 8;

if (!password) {
  console.error('BSS_ADMIN_PASSWORD is required. Nothing was written.');
  process.exit(1);
}
if (password.length < MIN_PASSWORD) {
  console.error(`BSS_ADMIN_PASSWORD must be at least ${MIN_PASSWORD} characters. Nothing was written.`);
  process.exit(1);
}
/* Required rather than optional, because the failure it prevents is silent:
   a payload with no address decrypts perfectly, unlocks the dashboard, and
   then cannot reach a single member record, which reads as a Firestore
   outage rather than a missing env var. */
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  console.error('BSS_ADMIN_EMAIL must be the Firebase admin account address. Nothing was written.');
  process.exit(1);
}

const htmlPath = path.join(root, 'src/admin/dashboard.html');
const codePath = path.join(root, 'src/admin/dashboard.js');
const outPath = path.join(root, 'public/admin-payload.json');

const html = await fs.readFile(htmlPath, 'utf8');
const code = await fs.readFile(codePath, 'utf8');

const plaintext = Buffer.from(
  JSON.stringify({ generatedAt: new Date().toISOString(), adminEmail, html, code }),
  'utf8',
);

const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(KDF_PREFIX + password, salt, iterations, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
cipher.setAAD(Buffer.from(AAD, 'utf8'));
const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);

const payload = {
  version: 1,
  kdf: 'PBKDF2-SHA-256',
  cipher: 'AES-256-GCM',
  iterations,
  lockAfterMinutes,
  /* Hash of exactly what was encrypted, published in the clear so the build
     gate can prove the shipped ciphertext matches the shipped sources without
     needing the password. It reveals nothing: those sources are files in this
     repo, already public. */
  sourceHash: sourceHashOf(html, code),
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  // the 16 byte GCM tag is appended to the ciphertext, which is the layout
  // WebCrypto's decrypt expects on the browser side
  ciphertext: Buffer.concat([body, cipher.getAuthTag()]).toString('base64'),
};

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(
  `Admin payload written: ${path.relative(root, outPath)} ` +
    `(${payload.ciphertext.length} base64 chars, ${iterations} iterations).`,
);
