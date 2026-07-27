/* ------------------------------------------------------------------
   Admin gate (v0.4.2, user brief: the same thing pavialeb.com has, for
   this site, with nothing behind it yet but a way out).

   THE SHAPE, AND WHY IT IS THIS SHAPE.
   There is no server here. Everything this page ships is readable by
   anyone who opens devtools, so a gate that COMPARES a password (in
   plaintext, or hashed, it makes no difference) protects nothing: the
   thing it guards was in the bundle all along, and the comparison is one
   breakpoint away from being stepped over. So the dashboard is not
   guarded, it is ENCRYPTED. public/admin-payload.json is AES-256-GCM
   ciphertext; the password is the key material, not an answer to check
   against. Wrong password means the decrypt fails its authentication tag,
   which is the only "wrong password" signal in this file. There is no
   branch to patch, no constant to read, and nothing to leak.

   WHAT THIS DOES NOT CLAIM. It does not turn a 9 character password into
   a strong secret. Anyone can fetch the payload and grind candidates
   offline; PBKDF2 at 600k iterations makes that cost real but not
   prohibitive at this length. Hence: nothing sensitive belongs in the
   payload until the longer password lands, and any future backend must
   enforce its OWN rules server side rather than trusting that this gate
   was passed. That is the honest security boundary and it is written here
   so nobody has to guess at it later.

   DEFENCES THAT ARE NOT THE ENCRYPTION.
   - Frame bust. This is a meta tag CSP (GitHub Pages cannot set headers),
     and frame-ancestors is ignored in meta by spec, so the anti
     clickjacking job falls to the check at the top of boot().
   - Idle lock, which tears the dashboard down and drops it from memory.
   - A growing delay per failed attempt. It is not a security control
     (an attacker attacks the file, not this form), it just makes pointing
     a script at the form itself pointless.
   - The password field is cleared on every outcome, success or failure,
     and the derived key is never stored: it goes out of scope with the
     unlock call.
   ------------------------------------------------------------------ */
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/instrument-sans';

import './styles/tokens.css';
import './styles/base.css';
import './styles/site-bg.css';
import './styles/auth.css';

import { initOceanMesh } from './modules/oceanMesh.js';

/* Must match scripts/build-admin-payload.mjs byte for byte. */
const KDF_PREFIX = 'bss-admin:';
const AAD = 'bss-admin:v1';

const WARN_SECONDS = 60;
const THROTTLE_STEP_MS = 900;
const THROTTLE_MAX_MS = 4500;

const encoder = new TextEncoder();
const bytes = (base64) => Uint8Array.from(atob(base64 || ''), (c) => c.charCodeAt(0));

function boot() {
  document.documentElement.classList.add('js');

  const root = document.querySelector('[data-admin]');
  if (!root) return;

  const gate = root.querySelector('[data-admin-gate]');
  const mount = root.querySelector('[data-admin-mount]');
  const form = root.querySelector('[data-admin-form]');
  const input = root.querySelector('#admin-pass');
  const submit = root.querySelector('[data-admin-submit]');
  const status = root.querySelector('[data-admin-status]');

  let payload = null;
  let failures = 0;
  let busy = false;
  let unlocked = false;
  let teardown = null;
  let idleTimer = 0;
  let warnTimer = 0;
  let warnTick = 0;

  const setStatus = (message, tone = 'info') => {
    status.textContent = message || '';
    status.dataset.tone = message ? tone : '';
  };

  const setBusy = (value) => {
    busy = value;
    root.classList.toggle('is-busy', value);
    if (submit) submit.disabled = value || !payload;
    if (input) input.disabled = value;
  };

  const resetField = () => {
    if (!input) return;
    input.value = '';
    if (input.type === 'text') {
      input.type = 'password';
      const toggle = root.querySelector('[data-admin-reveal]');
      if (toggle) {
        toggle.textContent = 'Show';
        toggle.setAttribute('aria-pressed', 'false');
        toggle.setAttribute('aria-label', 'Show password');
      }
    }
  };

  /* --- idle lock -------------------------------------------------------- */

  const clearWarning = () => {
    if (warnTick) {
      window.clearInterval(warnTick);
      warnTick = 0;
    }
    root.querySelector('.admin-warn')?.remove();
  };

  /* The idle warning is appended to the unlocked stage and styled as a fixed
     pill (auth.css), not laid out in flow: since v0.4.3 that stage is a bare
     background with a button row, so there is no panel for it to sit inside. */
  const showWarning = () => {
    if (!unlocked || root.querySelector('.admin-warn')) return;
    let left = WARN_SECONDS;
    const strip = document.createElement('div');
    strip.className = 'admin-warn';
    strip.setAttribute('role', 'alert');
    const label = document.createElement('span');
    label.textContent = `Locking in ${left}s for inactivity.`;
    const stay = document.createElement('button');
    stay.type = 'button';
    stay.className = 'auth__link';
    stay.textContent = 'Stay unlocked';
    stay.addEventListener('click', resetIdle);
    strip.append(label, stay);
    mount.appendChild(strip);
    warnTick = window.setInterval(() => {
      left -= 1;
      label.textContent = `Locking in ${Math.max(0, left)}s for inactivity.`;
      if (left <= 0) {
        window.clearInterval(warnTick);
        warnTick = 0;
      }
    }, 1000);
  };

  function resetIdle() {
    window.clearTimeout(idleTimer);
    window.clearTimeout(warnTimer);
    clearWarning();
    if (!unlocked) return;
    const minutes = Number(payload?.lockAfterMinutes) || 15;
    const total = minutes * 60 * 1000;
    warnTimer = window.setTimeout(showWarning, Math.max(0, total - WARN_SECONDS * 1000));
    idleTimer = window.setTimeout(() => lock('Locked after inactivity. Enter the password again.'), total);
  }

  ['click', 'keydown', 'pointermove', 'scroll', 'touchstart'].forEach((name) => {
    window.addEventListener(name, () => unlocked && resetIdle(), { passive: true });
  });

  /* --- unlock / lock ---------------------------------------------------- */

  function lock(message = '') {
    unlocked = false;
    // release anything the dashboard attached outside its own subtree BEFORE
    // the subtree goes, so nothing keeps firing into a removed tree
    try {
      teardown?.();
    } catch {
      /* a broken teardown must not block the lock */
    }
    teardown = null;
    window.clearTimeout(idleTimer);
    window.clearTimeout(warnTimer);
    clearWarning();
    mount.hidden = true;
    mount.replaceChildren();
    gate.hidden = false;
    resetField();
    setBusy(false);
    setStatus(message, 'info');
    input?.focus({ preventScroll: true });
  }

  async function decrypt(password) {
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
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes(payload.iv), additionalData: encoder.encode(AAD) },
      key,
      bytes(payload.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async function open(dashboard) {
    /* innerHTML with a decrypted string, which normally would be the worst
       line in the file. It is safe HERE for a specific reason, not a vague
       one: AES-GCM is authenticated encryption, so this string is bit for bit
       what the encryptor put in, or the decrypt above already threw. An
       attacker who can rewrite the payload cannot make it decrypt, and one who
       can rewrite the served JS does not need this line. */
    mount.innerHTML = dashboard.html;

    /* The dashboard's CODE runs as a real module from a blob URL rather than
       an inline <script>, which is what lets the built CSP stay
       script-src 'self' blob: with no 'unsafe-inline'. @vite-ignore stops
       Rollup trying to resolve a runtime string at build time. */
    const url = URL.createObjectURL(new Blob([dashboard.code], { type: 'text/javascript' }));
    try {
      const module = await import(/* @vite-ignore */ url);
      teardown =
        module.default?.(mount, {
          lock,
          lockAfterMinutes: Number(payload.lockAfterMinutes) || 15,
          // the dashboard cannot read import.meta.env from a blob module, so
          // the Vite base is handed in; it is what "View site" navigates to
          homeUrl: import.meta.env.BASE_URL,
        }) || null;
    } finally {
      URL.revokeObjectURL(url);
    }

    gate.hidden = true;
    mount.hidden = false;
    unlocked = true;
    resetIdle();
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !payload) return;
    const password = input.value;
    if (!password) return setStatus('Enter the admin password.', 'error');

    setBusy(true);
    setStatus('Unlocking.', 'info');

    const wait = Math.min(failures * THROTTLE_STEP_MS, THROTTLE_MAX_MS);
    if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));

    try {
      const dashboard = await decrypt(password);
      if (!dashboard?.html || !dashboard?.code) throw new Error('payload shape');
      failures = 0;
      resetField();
      setStatus('');
      await open(dashboard);
    } catch (error) {
      failures += 1;
      resetField();
      // Every failure reads the same from out here. The only thing that can
      // reach this branch for a real operator is a wrong password.
      setStatus('Incorrect password.', 'error');
      if (import.meta.env.DEV) console.warn('Unlock failed', error);
      input?.focus({ preventScroll: true });
    } finally {
      setBusy(false);
    }
  });

  root.querySelector('[data-admin-reveal]')?.addEventListener('click', (event) => {
    const toggle = event.currentTarget;
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    toggle.textContent = reveal ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(reveal));
    toggle.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    input.focus({ preventScroll: true });
  });

  document.querySelectorAll('[data-home-link]').forEach((a) => {
    a.href = import.meta.env.BASE_URL;
  });

  /* --- load the payload ------------------------------------------------- */

  setBusy(false);

  if (!window.isSecureContext || !window.crypto?.subtle) {
    // WebCrypto only exists in a secure context. localhost counts; plain http
    // on a LAN address does not, which is the case that actually bites.
    setStatus('This page needs a secure connection (https) to decrypt.', 'error');
    return;
  }

  fetch(`${import.meta.env.BASE_URL}admin-payload.json`, { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then((data) => {
      payload = data;
      setBusy(false);
      setStatus('');
      input?.focus({ preventScroll: true });
    })
    .catch((error) => {
      console.error('Admin payload unavailable', error);
      setStatus('The admin payload could not be loaded.', 'error');
    });
}

/* Clickjacking guard. A meta CSP cannot express frame-ancestors, so if this
   page is ever framed the defence has to be here: refuse to render, and try to
   break out. The break out throws on a cross origin top, which is exactly the
   case worth defending against, so the display none is the part that has to
   work on its own. */
if (window.top !== window.self) {
  document.documentElement.style.display = 'none';
  try {
    window.top.location = window.self.location.href;
  } catch {
    /* cross origin parent: nothing more to do, the page stays blank */
  }
} else {
  initOceanMesh();
  boot();
}
