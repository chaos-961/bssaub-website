/* ------------------------------------------------------------------
   Session hint cookie (v0.4.2, user brief: "keep in cookies and when
   opening the website it should say ... Logged in as username").

   WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT.
   This cookie holds ONE thing: the display name to greet the visitor
   with. It is a DISPLAY HINT and is never consulted for authorization,
   never sent to a server, and never trusted to mean "this person is
   signed in" anywhere a decision depends on it. The real session is the
   Firebase ID token, which lives in Firebase's own origin scoped
   IndexedDB store, is signed by Google, and is the only thing any future
   backend rule will ever accept. Forging this cookie by hand buys an
   attacker a wrong name in a toast on their own screen and nothing else.

   WHY A COOKIE AT ALL, when Firebase already persists the session.
   Cost. Reading the auth state properly means loading firebase/auth,
   which is ~45KB gz plus a network round trip, on a page whose entire
   job is a hero card and a physics field. This cookie is a few hundred
   bytes of JS that resolves before first paint, so index pays nothing
   for the greeting and the account page, which loads Firebase anyway,
   stays the single source of truth that writes it.

   THE COOKIE IS TREATED AS HOSTILE INPUT ON READ. Same origin script is
   the only thing that can write it, but "the only writer is us" is
   exactly the assumption that turns a stored value into stored XSS the
   day it stops being true. So: length capped, control characters and the
   HTML metacharacters stripped, and every consumer renders it with
   textContent, never innerHTML.

   SCOPE. Path is the Vite base, not "/". On a GitHub Pages PROJECT site
   every repo of the account shares the origin chaos-961.github.io, and a
   cookie at Path=/ is readable by all of them through document.cookie.
   The base scopes it to this site. It costs nothing and survives the
   custom domain flip untouched (BASE_URL becomes "/" there, which is
   correct once the origin is ours alone).
   ------------------------------------------------------------------ */

const COOKIE = 'bss_member';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const MAX_NAME = 40;

/* Everything a name is not allowed to be. Control characters would let a
   value break out of the cookie string itself; the rest are the HTML
   injection alphabet plus the cookie separators, so a mistake in a future
   consumer that reaches for innerHTML is inert rather than fatal.

   Written as an explicit loop rather than one clever regex on purpose: a
   character class that mixes a range with loose literals is easy to write
   wrong (a stray dash after a range silently opens a SECOND range and eats
   the digits), and a sanitizer that quietly does the wrong thing is worse
   than no sanitizer at all. */
const BANNED = new Set(['<', '>', '"', "'", '`', '\\', ';', ',', '=']);

export function sanitizeName(value) {
  if (typeof value !== 'string') return '';
  /* Capped by CODE POINT, not by `.slice(MAX_NAME)`. A plain slice cuts
     between the halves of a surrogate pair when a name ends in an emoji or
     any astral character, and a string holding a lone surrogate makes
     encodeURIComponent THROW — so writeSession would have died on a name
     nobody would think to test. Iterating with for..of walks code points, so
     counting here costs nothing extra. */
  const kept = [];
  for (const char of value) {
    if (kept.length >= MAX_NAME) break;
    const code = char.codePointAt(0);
    if (code < 0x20 || code === 0x7f) continue; // control characters
    if (BANNED.has(char)) continue; // HTML and cookie metacharacters
    kept.push(char);
  }
  return kept.join('').replace(/\s+/g, ' ').trim();
}

const path = () => import.meta.env.BASE_URL || '/';

// Secure is dropped on plain http so localhost keeps working; on GitHub Pages
// (and any custom domain, which will also be https) it is always present.
const secure = () => (location.protocol === 'https:' ? '; Secure' : '');

// built from COOKIE so a rename cannot leave the reader pointing at the old
// name while the writer moves on
const READ_RE = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]*)`);

export function readSession() {
  const match = document.cookie.match(READ_RE);
  if (!match) return null;
  let raw = '';
  try {
    raw = decodeURIComponent(match[1]);
  } catch {
    // a malformed percent sequence is not a name — drop it rather than throw
    return null;
  }
  const name = sanitizeName(raw);
  return name ? { name } : null;
}

export function writeSession(name) {
  const clean = sanitizeName(name);
  if (!clean) return;
  document.cookie = `${COOKIE}=${encodeURIComponent(clean)}; Max-Age=${MAX_AGE}; Path=${path()}; SameSite=Lax${secure()}`;
}

export function clearSession() {
  document.cookie = `${COOKIE}=; Max-Age=0; Path=${path()}; SameSite=Lax${secure()}`;
}
