/* ------------------------------------------------------------------
   Account page auth (v0.4.2, user brief: a login and register page on the
   same background, running on Firebase Auth).

   WHY FIREBASE IS LOADED WITH A DYNAMIC import().
   firebase/app plus firebase/auth is by far the largest thing this site
   ships (see §Budgets), and a static import would put it in the account
   entry chunk, in front of the ocean mesh and the nav. The page would sit
   on a bare background until ~50KB gz of identity SDK had arrived, parsed
   and run, on a page whose first job is to look like the rest of the
   site. Loading it as its own chunk lets the shell paint and the
   background start swelling immediately while the SDK streams in behind.
   The form is disabled until it lands, which is a state the page has to
   have anyway (a form that posts before its handler exists is worse than
   a form that says it is not ready yet).

   WHAT IS DELIBERATE ABOUT THE ERROR HANDLING.
   Sign in reports ONE failure message for every wrong credential case, so
   the page never tells an attacker whether an address has an account.
   Password reset always reports the same thing whether or not the address
   exists, for the same reason. Registration is the one place that has to
   admit an address is taken, because there is no way to help a real user
   past it otherwise, and Firebase's own email enumeration protection is
   the backstop there.

   WHAT NEVER HAPPENS HERE. No credential is logged, kept in a module
   variable, or written to storage: the password fields are cleared the
   moment a submit resolves either way. The session cookie this writes is
   a display name and nothing else (see session.js). Every string that came
   from a user is rendered with textContent.

   FIRESTORE (v0.4.8) RIDES BEHIND AUTH, NOT BESIDE IT. The membership
   record is only reachable once somebody is signed in, so putting it in
   the same Promise.all as firebase/auth would make every visitor to the
   GATE wait for a database they cannot query yet. It is started as soon
   as the app exists and awaited only where it is used, which means the
   sign in form goes live at the same moment it always did and an already
   signed in visitor loses nothing either: the panel paints their name
   first and fills in the membership when it lands.
   ------------------------------------------------------------------ */
import { firebaseConfig } from '../data/firebase.js';
import { MEMBERS, memberFrom, searchKeysFor } from '../data/membership.js';
import { sanitizeName, writeSession, clearSession } from './session.js';
import { initMemberPanel } from './memberPanel.js';

const MIN_PASSWORD = 8;

/* Client side throttle, on top of Firebase's own. It cannot stop a
   determined attacker (they would skip this page and call the REST API),
   so it is not a security control; it is what keeps a stuffing script
   pointed at the form itself from being free, and it costs one number. */
const THROTTLE_STEP_MS = 700;
const THROTTLE_MAX_MS = 4000;

const GENERIC_SIGNIN = 'Email or password is incorrect.';

const MESSAGES = {
  'auth/invalid-email': 'That email address does not look right.',
  'auth/missing-email': 'Enter your email address.',
  'auth/missing-password': 'Enter your password.',
  'auth/weak-password': `Pick a password with at least ${MIN_PASSWORD} characters.`,
  'auth/email-already-in-use': 'An account already exists for that email. Try signing in instead.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed':
    'Email sign in is not switched on for this project yet. Enable it in the Firebase console.',
  'auth/unauthorized-domain': 'This domain is not authorized for sign in in the Firebase console.',
};

const SIGNIN_FAILURES = new Set([
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/user-not-found',
  'auth/invalid-login-credentials',
  'auth/user-disabled',
]);

export function initAccount() {
  const root = document.querySelector('[data-auth]');
  if (!root) return;

  const gate = root.querySelector('[data-auth-gate]');
  const member = root.querySelector('[data-auth-member]');
  const status = root.querySelector('[data-auth-status]');
  const memberName = root.querySelector('[data-auth-name]');
  const memberEmail = root.querySelector('[data-auth-email]');
  const memberMark = root.querySelector('[data-auth-mark]');
  const signOutBtn = root.querySelector('[data-auth-signout]');
  const forms = new Map(
    Array.from(root.querySelectorAll('[data-auth-form]')).map((f) => [f.dataset.authForm, f]),
  );
  const tabs = Array.from(root.querySelectorAll('[data-auth-tab]'));

  const panel = initMemberPanel(root);

  let failures = 0;
  let busy = false;
  let auth = null;
  let api = null;
  let pendingName = '';
  let app = null;
  let store = null; // the firestore/lite import, started on first use only
  let db = null;
  let loadedFor = ''; // uid whose membership is loaded or in flight

  /* Firestore is fetched on the FIRST membership read and never before it,
     which is the difference between a signed out visitor paying for it and
     not. That visitor is the common case on this page (it is the sign in
     page), the chunk is the largest thing here after Auth itself, and they
     can never query a single document without a session. So the import is
     started here, from inside loadMembership, rather than beside the Auth one.

     firestore/lite rather than the full SDK, for the same reason it is lazy:
     this page does exactly one read and at most one write, and Lite drops the
     realtime channel, the offline cache and the local query engine that come
     with the full build. Nothing on this page wants a live listener. */
  const openStore = () => {
    if (!store) {
      store = import('firebase/firestore/lite').then((sdk) => {
        db = sdk.getFirestore(app);
        return sdk;
      });
    }
    return store;
  };

  /* --- small DOM helpers ------------------------------------------------ */

  const setStatus = (message, tone = 'info') => {
    if (!status) return;
    status.textContent = message || '';
    status.dataset.tone = message ? tone : '';
  };

  const setBusy = (value) => {
    busy = value;
    root.classList.toggle('is-busy', value);
    root.querySelectorAll('button, input').forEach((el) => {
      if (el.dataset.authAlways === undefined) el.disabled = value || !api;
    });
  };

  const clearPasswords = () => {
    root.querySelectorAll('input[type="password"], input[data-was-password]').forEach((input) => {
      input.value = '';
    });
  };

  const showTab = (key, { focusPanel = true } = {}) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.authTab === key;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      // roving tabindex: only the selected tab is in the page's tab order, and
      // the arrow keys below are what reach the other one. Both halves are
      // required — see the keydown handler.
      tab.tabIndex = active ? 0 : -1;
    });
    forms.forEach((form, name) => {
      // `hidden` only actually hides because base.css forces it to beat
      // `.auth__form { display: grid }`. Without that rule both forms render
      // at once and this whole control does nothing visible (v0.4.3 fix).
      form.hidden = name !== key;
    });
    setStatus('');
    if (focusPanel) forms.get(key)?.querySelector('input')?.focus({ preventScroll: true });
  };

  /* Tabs: click, plus the arrow keys the ARIA tablist pattern requires.
     The roving tabindex above takes the unselected tab OUT of the page's tab
     order, which is correct for the pattern and completely broken without a
     key handler to put focus back — a keyboard visitor could not reach
     "Create account" at all (measured on the live v0.4.2 page: tabIndex -1,
     not in the focusable set, no handler). Automatic activation, so moving
     focus switches the panel, which is the expected behaviour for two tabs
     whose panels are already loaded. */
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => showTab(tab.dataset.authTab));
    tab.addEventListener('keydown', (event) => {
      const last = tabs.length - 1;
      let next = null;
      if (event.key === 'ArrowRight') next = tabs[index === last ? 0 : index + 1];
      else if (event.key === 'ArrowLeft') next = tabs[index === 0 ? last : index - 1];
      else if (event.key === 'Home') next = tabs[0];
      else if (event.key === 'End') next = tabs[last];
      if (!next) return;
      event.preventDefault();
      showTab(next.dataset.authTab, { focusPanel: false });
      next.focus();
    });
  });

  // reveal toggles: swap the input type and keep the button's label honest
  root.querySelectorAll('[data-auth-reveal]').forEach((toggle) => {
    const input = root.querySelector(`#${CSS.escape(toggle.dataset.authReveal)}`);
    if (!input) return;
    input.dataset.wasPassword = '';
    toggle.addEventListener('click', () => {
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      toggle.textContent = reveal ? 'Hide' : 'Show';
      toggle.setAttribute('aria-pressed', String(reveal));
      toggle.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
      input.focus({ preventScroll: true });
    });
  });

  /* --- the membership record -------------------------------------------- */

  /* One read on arrival, and a write only when there is something to correct.
     Skipping the unchanged case matters more than it looks: this runs on every
     visit to the page by every member, and the free tier's write allowance is
     less than half its read allowance.

     The name and email are mirrored into the record because the admin searches
     THIS collection, not Firebase Auth, which a static page has no way to list.
     So the row has to carry enough to be found by a human typing a half
     remembered name. It carries nothing else: expiresAt is written by the admin
     account alone, and the rules refuse this path if it tries (see the rules in
     §Open items, and membership.js for the record's shape). */
  const loadMembership = async (user) => {
    if (!panel || loadedFor === user.uid) return;
    const uid = user.uid;
    loadedFor = uid;
    panel.pending();

    const name = sanitizeName(user.displayName || pendingName) || 'Member';
    const email = user.email || '';

    try {
      const sdk = await openStore();
      const ref = sdk.doc(db, MEMBERS, uid);
      const snap = await sdk.getDoc(ref);
      let data;
      if (!snap.exists()) {
        data = { name, email, searchKeys: searchKeysFor(name), expiresAt: 0, createdAt: Date.now() };
        await sdk.setDoc(ref, data);
      } else {
        data = snap.data() || {};
        if (data.name !== name || data.email !== email) {
          await sdk.updateDoc(ref, { name, email, searchKeys: searchKeysFor(name) });
          data = { ...data, name, email };
        }
      }
      // a sign out (or a different account) landed while this was in flight
      if (loadedFor !== uid) return;
      panel.show(memberFrom(uid, data));
    } catch (error) {
      if (loadedFor !== uid) return;
      loadedFor = ''; // a later render may retry; a failed read is not an answer
      console.warn('Membership unavailable', error?.code || error);
      panel.fail();
    }
  };

  /* --- signed in / signed out views ------------------------------------- */

  const renderSignedIn = (user) => {
    const name = sanitizeName(user.displayName || pendingName) || 'Member';
    if (memberName) memberName.textContent = name; // untrusted, textContent only
    if (memberEmail) memberEmail.textContent = user.email || '';
    if (memberMark) memberMark.textContent = name.slice(0, 1).toUpperCase();
    writeSession(name);
    if (gate) gate.hidden = true;
    if (member) member.hidden = false;
    root.classList.add('is-authed');
    setStatus('');
    // deliberately not awaited: the identity is on screen now and the card
    // fills in behind it, rather than the whole panel waiting on a round trip
    loadMembership(user);
  };

  const renderSignedOut = () => {
    pendingName = '';
    loadedFor = '';
    clearSession();
    panel?.clear();
    if (member) member.hidden = true;
    if (gate) gate.hidden = false;
    root.classList.remove('is-authed');
    clearPasswords();
  };

  /* --- error surface ---------------------------------------------------- */

  const explain = (error, context) => {
    const code = String(error?.code || '');
    if (context === 'signin' && SIGNIN_FAILURES.has(code)) return GENERIC_SIGNIN;
    if (MESSAGES[code]) return MESSAGES[code];
    // Anything unmapped is a bug or an outage, not something to paste at the
    // visitor: keep the console detail for us and the copy plain for them.
    console.warn('Auth error', code || error);
    return 'Something went wrong. Try again in a moment.';
  };

  const throttle = async () => {
    const wait = Math.min(failures * THROTTLE_STEP_MS, THROTTLE_MAX_MS);
    if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
  };

  /* --- submissions ------------------------------------------------------ */

  const onSignIn = async (event) => {
    event.preventDefault();
    if (busy || !api) return;
    const email = root.querySelector('#si-email').value.trim();
    const password = root.querySelector('#si-pass').value;
    if (!email) return setStatus(MESSAGES['auth/missing-email'], 'error');
    if (!password) return setStatus(MESSAGES['auth/missing-password'], 'error');

    setBusy(true);
    setStatus('Signing in.', 'info');
    await throttle();
    try {
      await api.signInWithEmailAndPassword(auth, email, password);
      failures = 0;
      clearPasswords();
      // onAuthStateChanged paints the signed in view
    } catch (error) {
      failures += 1;
      clearPasswords();
      setStatus(explain(error, 'signin'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onRegister = async (event) => {
    event.preventDefault();
    if (busy || !api) return;
    const rawName = root.querySelector('#re-name').value;
    const name = sanitizeName(rawName);
    const email = root.querySelector('#re-email').value.trim();
    const password = root.querySelector('#re-pass').value;
    const confirm = root.querySelector('#re-pass2').value;

    if (name.length < 2) return setStatus('Enter the name you want on your account.', 'error');
    if (!email) return setStatus(MESSAGES['auth/missing-email'], 'error');
    if (password.length < MIN_PASSWORD) {
      return setStatus(MESSAGES['auth/weak-password'], 'error');
    }
    /* Length before match, deliberately: a short password reported as "they do
       not match" sends people hunting for a typo that is not there. Compared
       here and nowhere else, and both fields are wiped on every outcome. */
    if (password !== confirm) {
      return setStatus('The two passwords do not match.', 'error');
    }

    setBusy(true);
    setStatus('Creating your account.', 'info');
    await throttle();
    // Set BEFORE the call, not after it. Firebase fires onAuthStateChanged the
    // instant the account exists, which can land while this await is still
    // pending and always lands before updateProfile does — assigning after the
    // await is a race the listener wins, and the view flashes "Member" first.
    pendingName = name;
    try {
      const credential = await api.createUserWithEmailAndPassword(auth, email, password);
      await api.updateProfile(credential.user, { displayName: name });
      failures = 0;
      clearPasswords();
      renderSignedIn(credential.user);
    } catch (error) {
      failures += 1;
      pendingName = '';
      clearPasswords();
      setStatus(explain(error, 'register'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    if (busy || !api) return;
    const email = root.querySelector('#si-email').value.trim();
    if (!email) {
      setStatus('Enter your email address first, then ask for a reset link.', 'error');
      root.querySelector('#si-email').focus({ preventScroll: true });
      return;
    }
    setBusy(true);
    try {
      await api.sendPasswordResetEmail(auth, email);
    } catch (error) {
      // Deliberately swallowed for the enumeration cases: an unknown address
      // and a known one must be indistinguishable from out here. Only a hard
      // failure (bad address shape, network, rate limit) is worth reporting.
      const code = String(error?.code || '');
      if (code !== 'auth/user-not-found' && code !== 'auth/invalid-credential') {
        setBusy(false);
        setStatus(explain(error, 'reset'), 'error');
        return;
      }
    }
    setBusy(false);
    setStatus('If that address has an account, a reset link is on its way.', 'ok');
  };

  const onSignOut = async () => {
    if (!api) return;
    setBusy(true);
    try {
      await api.signOut(auth);
      setStatus('You are signed out.', 'ok');
    } catch (error) {
      setStatus(explain(error, 'signout'), 'error');
    } finally {
      setBusy(false);
    }
  };

  forms.get('signin')?.addEventListener('submit', onSignIn);
  forms.get('register')?.addEventListener('submit', onRegister);
  root.querySelector('[data-auth-reset]')?.addEventListener('click', onReset);
  signOutBtn?.addEventListener('click', onSignOut);

  /* --- boot ------------------------------------------------------------- */

  setBusy(false); // disables everything: api is still null
  setStatus('Connecting.', 'info');

  (async () => {
    try {
      const [{ initializeApp }, authSdk] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
      ]);
      app = initializeApp(firebaseConfig);
      auth = authSdk.getAuth(app);
      // Explicit rather than implied: the session survives a tab close and
      // lives in Firebase's own IndexedDB store, which is what the cookie in
      // session.js is a hint ABOUT and never a replacement for.
      await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
      api = {
        signInWithEmailAndPassword: authSdk.signInWithEmailAndPassword,
        createUserWithEmailAndPassword: authSdk.createUserWithEmailAndPassword,
        sendPasswordResetEmail: authSdk.sendPasswordResetEmail,
        updateProfile: authSdk.updateProfile,
        signOut: authSdk.signOut,
      };
      setBusy(false);
      setStatus('');
      authSdk.onAuthStateChanged(auth, (user) => {
        if (user) renderSignedIn(user);
        else renderSignedOut();
      });
    } catch (error) {
      console.error('Firebase failed to load', error);
      setStatus('Sign in is unavailable right now. Try again in a moment.', 'error');
    }
  })();
}
