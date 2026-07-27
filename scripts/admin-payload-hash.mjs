/* The one definition of "what was encrypted", shared by the encryptor and the
   build gate so the two can never drift. Kept in its own file because the
   encryptor runs side effects on import and the gate must not trigger them.

   Digest of digests rather than a delimiter join: concatenating two files with
   a separator makes the hash depend on a byte that could also appear inside
   either file, and "pick a delimiter the inputs cannot contain" is not a
   promise source files can keep. Hashing each side first makes the boundary
   unambiguous by construction. */
import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest();

export const sourceHashOf = (html, code) =>
  crypto.createHash('sha256').update(sha256(html)).update(sha256(code)).digest('hex');
