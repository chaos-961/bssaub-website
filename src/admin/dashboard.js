/* Encrypted admin dashboard code (v0.4.2).

   Like its markup, this file is never served. It is encrypted into
   public/admin-payload.json and reaches the browser only as an AES-GCM
   ciphertext that the admin password decrypts. src/admin.js turns the
   decrypted text into a module and calls the default export below.

   IT IS A PLAIN MODULE WITH NO IMPORTS, AND IT HAS TO STAY THAT WAY.
   It is loaded from a blob URL at runtime, long after Rollup has finished,
   so there is no bundler to resolve a bare specifier like 'gsap' and no
   import map to fall back on. Anything this needs arrives through the `api`
   argument. That is a real constraint on what belongs here, and it is also
   why the api object is the seam to widen when the admin grows.

   Returns a teardown. The mount's own DOM is destroyed on lock, so listeners
   ON IT die with it; the return value is for anything attached to document,
   window or a timer, which is exactly the leak Pavia's admin had to fix once
   already. Returning it now costs one line and means the next feature has
   somewhere obvious to put its cleanup. */
export default function mount(root, api) {
  const lock = root.querySelector('[data-admin-lock]');
  if (lock) lock.textContent = `${api.lockAfterMinutes} minutes idle`;

  const built = root.querySelector('[data-admin-built]');
  if (built) {
    // generatedAt is an ISO string from the encryptor; show the date only
    built.textContent = api.generatedAt ? api.generatedAt.slice(0, 10) : 'unknown';
  }

  root.querySelector('[data-admin-signout]')?.addEventListener('click', () => {
    api.lock('Signed out.');
  });

  return () => {};
}
