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

   THE MEMBERS CONNECTION (v0.4.8), which changes what this page is.
   Until now the payload was the whole story: decrypt it and there was
   nothing behind it. Now the dashboard reads and writes real member
   records, and Firestore only ever answers to a Firebase identity, so the
   gate signs in to a dedicated admin account whose ADDRESS travels inside
   the ciphertext and whose PASSWORD is the same one that just decrypted
   it. One secret, typed once, doing both jobs.

   That is a deliberate trade and it moves the boundary. A cracked payload
   used to be worth some markup; it is now worth write access to the
   members collection, which is exactly why the honest note above about
   password length stopped being theoretical. The mitigation is length,
   and it is the user's to apply.

   THE RULES ARE THE AUTHORITY, NOT THIS PAGE. Firestore checks the signed
   in address on every read and write, so patching this file, skipping the
   gate, or forging an unlock buys nothing: without the Firebase session
   the collection is closed. That is the opposite of the usual static site
   admin, where the client is the only thing standing in the way.

   Three things keep the session itself small. It runs on a NAMED Firebase
   app, so it cannot touch the member session the account page keeps in
   this same origin's IndexedDB (the auth store is keyed by app name). It
   uses inMemoryPersistence, so nothing about it is ever written to disk
   and closing the tab is a sign out. And the idle lock signs it out and
   deletes the app, so a locked admin is a signed out one.

   The connection is started but NOT awaited at unlock, so a slow round
   trip cannot hold the dashboard shut; the search area waits on it.
   ------------------------------------------------------------------ */
import '@fontsource-variable/roboto-condensed';
import '@fontsource-variable/instrument-sans';

/* Fetched with this chunk and not before it: the console's stylesheet is as
   absent as its markup until the password has proved itself. tokens.css and
   base.css come with it because auth.css is written on top of them. */
import './styles/tokens.css';
import './styles/base.css';
import './styles/auth.css';

import { firebaseConfig } from './data/firebase.js';
/* Statically imported although a LOCKED page can use none of it. These are
   pure functions with no dependencies of their own, and the alternative (a
   fourth dynamic chunk) would leave the dashboard unable to do arithmetic
   until a network round trip finished, to save a few hundred bytes on a page
   exactly one person ever opens. */
import {
  MEMBERS,
  META,
  REVISION,
  daysLeft,
  extend,
  formatDate,
  formatLeft,
  isActive,
  makeRevision,
  matchesTerm,
  memberFrom,
  queryKeyFor,
} from './data/membership.js';

/* Must match scripts/build-admin-payload.mjs byte for byte. */
const KDF_PREFIX = 'bss-admin:';
const AAD = 'bss-admin:v1';

/* Pulled deliberately high and REPORTED when it bites (the dashboard prints a
   line when it does). The client side filter below narrows an array-contains
   hit further, so a low cap here would silently drop rows the admin is
   entitled to see, and a search that quietly hides someone is worse than one
   that says it stopped counting. */
const SEARCH_LIMIT = 50;

/* How many members a browsed page shows (v0.5.6). It is deliberately a
   separate number from SEARCH_LIMIT above even though the two are equal today:
   one is how much of a search is worth showing before asking for a narrower
   term, the other is a page size, and a reason to change either has nothing to
   do with the other. It also sets what a page of rows COSTS, at one read a
   row, which is the only number on this page that scales with use. */
const PAGE_SIZE = 50;

/* ------------------------------------------------------------------
   THE MEMBER CACHE (v0.5.7, user brief: fewer Firebase reads, with a
   version so an updated page is fetched again rather than trusted).

   IT IS sessionStorage AND NOT localStorage, which is a security call
   and not a shrug. This page runs its Firebase session on
   inMemoryPersistence precisely so that nothing about the admin is ever
   written to disk and closing the tab is a sign out; parking every
   member's name and address in localStorage would undo that, on an
   origin every other project of this GitHub account shares (§Open
   items). sessionStorage has exactly the lifetime the auth session was
   given on purpose: per tab, gone when the tab closes. What it buys over
   plain memory is the one case the user actually described, a RELOAD,
   which keeps the tab and therefore keeps the cache.

   IT IS OWNED HERE RATHER THAN IN THE DASHBOARD because signOut() is what
   has to erase it: a locked admin holding a readable member list in storage
   would undercut the lock it just performed.
   Unlocking cancels the timer, so a reload and a prompt answer normally
   keeps every byte.

   WHAT IS NOT CLAIMED, so nobody reads more into the two wipes above
   than they are worth. sessionStorage belongs to the TAB, not to this
   page, and anyone with devtools open on that tab can read it while it
   is there. The wipes bound how long "there" is for the cases this page
   can see: it locks, it goes; it offers a way out to the site, and that
   button takes it (dashboard.js); it is left sitting at the gate, and
   the timer takes it. A tab the admin navigates away from by hand keeps
   it until the tab is closed. Everything in it is a name, an address and
   a date, none of it is a credential, and none of it is trusted by
   Firestore, which checks the signed in identity on every call.

   Every access is wrapped: storage throws on a quota and can be absent
   outright in some privacy modes, and a cache is an optimisation, never
   a requirement. A failure here costs reads and nothing else.
   ------------------------------------------------------------------ */
const CACHE_KEY = 'bss.admin.members.v1';

const cacheStore = {
  read() {
    try {
      return JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    } catch {
      return null;
    }
  },
  write(value) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(value));
    } catch {
      /* quota, or storage disabled: the console works, it just pays reads */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch {
      /* nothing to do and nothing to report: there is no cache either way */
    }
  },
};

const encoder = new TextEncoder();
const bytes = (base64) => Uint8Array.from(atob(base64 || ''), (c) => c.charCodeAt(0));

/* The exclusive upper bound of a prefix range: the same string with its last
   code unit bumped by one. The usual Firestore idiom appends U+F8FF instead,
   and it is avoided here on purpose. That character is in a private use block,
   so it renders as NOTHING in an editor and in a diff, which makes it a byte a
   future edit can delete without anyone seeing it happen; and it is only an
   upper bound for text that sorts below it, so an address holding any higher
   character would fall outside its own prefix range. Incrementing is exact and
   visible. */
const afterPrefix = (value) =>
  value.slice(0, -1) + String.fromCharCode(value.charCodeAt(value.length - 1) + 1);

/* ------------------------------------------------------------------
   The members connection. Every Firebase call on this page lives inside
   this function, which is only ever reached with a password that has
   already decrypted the payload.
   ------------------------------------------------------------------ */
async function connect(email, password) {
  const [{ initializeApp, deleteApp }, authSdk, dbSdk] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore/lite'),
  ]);

  /* A NAMED app, which is the part that keeps this off the member session.
     Firebase keys its auth store by app name, so the default app's entry (the
     one account.html writes, on this same GitHub Pages origin) is a different
     key entirely and is neither read nor overwritten here. */
  const app = initializeApp(firebaseConfig, 'bss-admin');
  const auth = authSdk.getAuth(app);
  await authSdk.setPersistence(auth, authSdk.inMemoryPersistence);
  await authSdk.signInWithEmailAndPassword(auth, email, password);

  /* firestore/lite rather than the full SDK: this dashboard runs a handful of
     one shot queries and writes, and the realtime channel, the offline cache
     and the local query engine that come with the full build would all be dead
     weight sitting behind a password gate. */
  const db = dbSdk.getFirestore(app);
  const readRows = (snap) => snap.docs.map((entry) => memberFrom(entry.id, entry.data()));

  /* The revision marker (v0.5.7, membership.js has the full note). Reading it
     is one read and vouches for every cached page at once; writing it is what
     tells the next reader, in any tab or on any machine, that the pages it is
     holding are worth nothing.

     stamp() is folded into both writes below rather than left for the caller,
     so a write can never ship without its bump and quietly leave a stale list
     on somebody else's screen. It is best effort and REPORTS ITS FAILURE by
     returning null, which the dashboard reads as "I can no longer vouch for
     anything" and answers by dropping its cache. That is also the honest
     behaviour on the day this deploys, before the new rules are published: the
     marker is unreadable and unwritable, so the console simply pays the reads
     it has always paid. */
  const revRef = dbSdk.doc(db, META, REVISION);

  const stamp = async () => {
    const rev = makeRevision();
    try {
      await dbSdk.setDoc(revRef, { rev });
      return rev;
    } catch (error) {
      console.warn('Revision bump failed', error?.code || error);
      return null;
    }
  };

  /* THREE ORDERINGS AND NOT ONE COMPOSITE INDEX (v0.5.6), which is what lets
     browsing work the moment the rules are pasted in, with no console step to
     remember and nothing to keep in sync with this file. Every query below
     orders by the same field it ranges over, or ranges over nothing at all,
     and Firestore maintains single field indexes on its own. Sorting the
     Subscribed view by NAME instead would pair a range on expiresAt with an
     orderBy on name, and that IS a composite index: a console step, and a
     filter that returns an error until somebody performs it.

     TOMBSTONES FALL OUT OF ALL THREE FOR FREE, with no `revoked` test
     anywhere. A document that lacks a field is simply absent from that
     field's index, and a deleted member's row is replaced by { revoked: true }
     alone (see remove() below), so orderBy('name') cannot see it and neither
     expiresAt range can reach it either.

     `now` is passed in rather than read here so that ONE browse pins ONE
     instant: its count and every one of its pages then answer the same
     question, and a membership lapsing mid session cannot shuffle rows
     between pages under the admin's fingers. */
  const viewOf = (filter, now) => {
    if (filter === 'live') return [dbSdk.where('expiresAt', '>', now), dbSdk.orderBy('expiresAt')];
    if (filter === 'off') {
      return [dbSdk.where('expiresAt', '<=', now), dbSdk.orderBy('expiresAt', 'desc')];
    }
    return [dbSdk.orderBy('name')];
  };

  return {
    /* ONE query and NO composite index, which is what lets this work the
       moment the rules are pasted in with no console index step. A name search
       hits the prefix array membership.js builds and is then narrowed here for
       exactness; an address search runs a range on the email field. Both are
       single field indexes, and Firestore maintains those automatically. */
    async search(term) {
      const clean = String(term || '').trim();
      if (!clean) return { rows: [], capped: false };

      if (clean.includes('@')) {
        const needle = clean.toLowerCase();
        const snap = await dbSdk.getDocs(
          dbSdk.query(
            dbSdk.collection(db, MEMBERS),
            dbSdk.orderBy('email'),
            dbSdk.startAt(needle),
            dbSdk.endBefore(afterPrefix(needle)),
            dbSdk.limit(SEARCH_LIMIT),
          ),
        );
        return { rows: readRows(snap), capped: snap.docs.length >= SEARCH_LIMIT };
      }

      const key = queryKeyFor(clean);
      if (!key) return { rows: [], capped: false };
      const snap = await dbSdk.getDocs(
        dbSdk.query(
          dbSdk.collection(db, MEMBERS),
          dbSdk.where('searchKeys', 'array-contains', key),
          dbSdk.limit(SEARCH_LIMIT),
        ),
      );
      const found = readRows(snap)
        .filter((row) => matchesTerm(row.name, clean))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { rows: found, capped: snap.docs.length >= SEARCH_LIMIT };
    },

    /* HOW MANY, and the cheap way to get it (v0.5.6). Firestore bills an
       aggregation at ONE read per thousand index entries matched, so knowing
       the page count of the whole collection costs a single read at this size.
       Fetching the rows in order to count them would cost one read each, i.e.
       the entire collection every time the pager needed a number.

       getCount and NOT getCountFromServer: the lite SDK names it differently
       from the full one, and getting it wrong is invisible until runtime
       behind a password gate, where it reads as an undefined function. */
    async count(filter, now) {
      const snap = await dbSdk.getCount(
        dbSdk.query(dbSdk.collection(db, MEMBERS), ...viewOf(filter, now)),
      );
      return snap.data().count;
    },

    /* ONE PAGE, ONE QUERY, and the cursor is what keeps it that way. Firestore
       has no offset that does not bill for the rows it steps over, so paging
       forward is startAfter on the last document of the page before, which
       reads exactly the rows it is about to show and not one more.

       `span` is how many pages to cross in one go. It is 1 for next, for
       previous, and for any page whose cursor the dashboard already holds from
       an earlier visit, which is every page behind the furthest one walked. It
       is larger only when the admin jumps ahead to a page nobody has reached
       yet. Crossing those in one query costs the same reads as walking them
       one by one (the skipped rows are billed either way) for a single round
       trip instead of several, and `marks` hands back the boundary of every
       page crossed, so the ground is bought once and never again. */
    async page(filter, now, after, span = 1) {
      const constraints = viewOf(filter, now);
      if (after) constraints.push(dbSdk.startAfter(after));
      constraints.push(dbSdk.limit(PAGE_SIZE * Math.max(1, span)));
      const docs = (
        await dbSdk.getDocs(dbSdk.query(dbSdk.collection(db, MEMBERS), ...constraints))
      ).docs;

      /* The boundary at the end of each WHOLE page crossed. A partial final
         chunk deliberately gets none: there is no page after it to cut. */
      const marks = [];
      for (let i = PAGE_SIZE; i <= docs.length; i += PAGE_SIZE) marks.push(docs[i - 1]);

      /* The chunk asked for, unless the collection shrank between the count
         and this query, in which case the last one with anything in it. */
      const chunk = Math.max(0, Math.min(span - 1, Math.ceil(docs.length / PAGE_SIZE) - 1));
      const rows = docs.slice(chunk * PAGE_SIZE, (chunk + 1) * PAGE_SIZE);
      return { rows: rows.map((entry) => memberFrom(entry.id, entry.data())), marks, chunk };
    },

    /* The marker this returns is what lets the caller keep the cache it has
       just corrected by hand instead of throwing it away: the dashboard wrote
       the new expiry into its own rows, so adopting the marker it caused is
       the difference between "Add 1 year" costing nothing and costing a fresh
       page. A null means the bump did not land, and the dashboard drops
       everything rather than vouch for a list it can no longer confirm. */
    async setExpiry(uid, expiresAt) {
      await dbSdk.updateDoc(dbSdk.doc(db, MEMBERS, uid), { expiresAt });
      return stamp();
    },

    /* Read once per console load and then at most every half minute, which is
       what turns a page turn from fifty reads into one, or into none. It
       reports three different things and the difference matters: a string is
       the live marker, '' is "no write has ever been stamped", and null is "I
       could not find out", which is the only one that must never be cached
       against. */
    async revision() {
      try {
        const snap = await dbSdk.getDoc(revRef);
        return snap.exists() ? String(snap.data()?.rev || '') : '';
      } catch (error) {
        console.warn('Revision read failed', error?.code || error);
        return null;
      }
    },

    /* DELETE MEANS THE PERSON IS GONE, and getting there needs a word of
       explanation because a static site cannot do it in one call. Removing a
       Firebase Auth account requires either the Admin SDK on a server, which
       this site does not have, or the account deleting ITSELF while signed in.
       So deleting the row alone would be worse than useless: their login would
       still work and their next visit would quietly write a fresh empty row,
       undoing the delete with nobody watching.

       Instead the row is REPLACED by a tombstone. That one field does three
       jobs at once. It drops them out of every search, because the tombstone
       carries no searchKeys and no email for either query to match. It cannot
       be overwritten by the member: the rules refuse their create (the doc
       exists) and refuse their update (expiresAt would have to equal a field
       the tombstone does not have), so they can never resurrect themselves.
       And it is the instruction the account page acts on, deleting its own
       Auth account the next time that person opens the site.

       Net effect: gone from the admin the instant the button is pressed, and
       locked out permanently from that moment whether or not they ever come
       back to collect the deletion. */
    async remove(uid) {
      await dbSdk.setDoc(dbSdk.doc(db, MEMBERS, uid), { revoked: true });
      return stamp();
    },

    async close() {
      try {
        await authSdk.signOut(auth);
      } finally {
        await deleteApp(app);
      }
    },
  };
}


/* ------------------------------------------------------------------
   THE SHELL SEAM.

   Everything above is what this file has always been: the payload's crypto,
   the Firebase connection, and the member cache. What follows is the three
   verbs the shared admin shell calls — the gate, the idle lock and the tab
   strip that used to live at the bottom of this file are the template's now.

   THE PASSWORD IS STILL THE KEY, NOT AN ANSWER. There is no comparison here
   to patch and no constant to read: a wrong password fails AES-GCM's
   authentication tag, which is the only "wrong password" signal in this file.
   ------------------------------------------------------------------ */

let payload = null;

async function loadPayload() {
  if (payload) return payload;
  const response = await fetch(`${import.meta.env.BASE_URL}admin-payload.json`, {
    cache: 'no-cache',
  });
  if (!response.ok) {
    const error = new Error('payload');
    error.reason = 'payload';
    throw error;
  }
  payload = await response.json();
  return payload;
}

async function decrypt(password) {
  const sealed = await loadPayload();
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
      salt: bytes(sealed.salt),
      iterations: Number(sealed.iterations) || 600000,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes(sealed.iv), additionalData: encoder.encode(AAD) },
    key,
    bytes(sealed.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

export async function signIn(password, ui) {
  if (!window.isSecureContext || !window.crypto?.subtle) {
    /* WebCrypto only exists in a secure context. localhost counts; plain http
       on a LAN address does not, which is the case that actually bites. */
    const error = new Error('crypto');
    error.reason = 'crypto';
    throw error;
  }
  ui.busy(true, 'Deriving key…', 70);
  const dashboard = await decrypt(password).catch((error) => {
    if (error.reason) throw error;
    const wrong = new Error('password');
    wrong.reason = 'password';
    throw wrong;
  });
  if (!dashboard?.html || !dashboard?.code) {
    const error = new Error('payload');
    error.reason = 'payload';
    throw error;
  }

  /* Started here, where the password is still in scope, and NOT awaited: the
     console opens either way and its search area waits on this promise itself.
     Awaiting would put a sign-in round trip between the correct password and
     the page appearing, for no gain.

     The password's last use is this call. It was never in a module variable
     and it is not in one now. */
  const connection = connect(dashboard.adminEmail, password);
  connection.catch(() => {}); // the console reports it; this stops an unhandled rejection
  return { dashboard, connection };
}

export function signOut(session) {
  /* A locked admin must not leave the member list readable in storage: the
     whole point of the lock is that this machine is now unattended. */
  cacheStore.clear();
  try {
    window.__BSS_TEARDOWN__?.();
  } catch {
    /* a broken teardown must not block the lock */
  }
  window.__BSS_TEARDOWN__ = null;
  /* Signing out of Firebase, not merely hiding the console: anything less would
     leave an idle machine holding a session that can write every member record.
     Detached deliberately — a network hiccup on the way out must not stop it. */
  session?.connection?.then((members) => members.close()).catch(() => {});
}

export async function mount(api, session) {
  const { dashboard, connection } = session;

  const panels = api.tabs([
    { id: 'overview', label: 'Overview' },
    { id: 'members', label: 'Members' },
  ]);

  const host = document.getElementById('panels');

  /* innerHTML with a decrypted string, which normally would be the worst line
     in the file. It is safe HERE for a specific reason, not a vague one:
     AES-GCM is authenticated encryption, so this string is bit for bit what the
     encryptor put in, or the decrypt above already threw. An attacker who can
     rewrite the payload cannot make it decrypt, and one who can rewrite the
     served JS does not need this line. */
  const parsed = document.createElement('div');
  parsed.innerHTML = dashboard.html;
  for (const part of parsed.querySelectorAll('[data-bss]')) {
    const into = panels[part.getAttribute('data-bss')];
    if (into) into.append(...part.childNodes);
  }
  /* The two row <template>s belong to no tab. */
  for (const loose of [...parsed.children]) host.appendChild(loose);

  /* The console's code runs as a real module from a blob URL rather than an
     inline <script>, which is what lets the built CSP stay script-src 'self'
     blob: with no 'unsafe-inline'. @vite-ignore stops Rollup trying to resolve
     a runtime string at build time. */
  const url = URL.createObjectURL(new Blob([dashboard.code], { type: 'text/javascript' }));
  try {
    const module = await import(/* @vite-ignore */ url);
    /* `api` here is the console's own seam, not the shell's. The console is a
       blob module with no bundler behind it, so it can import nothing: the
       maths comes through `membership` and the database through `members`, both
       as plain functions it can call. Each members call chains off the
       connection promise, so the console never has to know whether sign-in has
       landed yet. */
    const live = (run) => (...args) => connection.then((members) => run(members, ...args));
    window.__BSS_TEARDOWN__ =
      module.default?.(host, {
        lock: () => api.lock('out'),
        lockAfterMinutes: Number(payload?.lockAfterMinutes) || 15,
        homeUrl: import.meta.env.BASE_URL,
        membership: { daysLeft, extend, formatDate, formatLeft, isActive },
        members: {
          ready: () => connection.then(() => true),
          pageSize: PAGE_SIZE,
          search: live((members, term) => members.search(term)),
          count: live((members, filter, now) => members.count(filter, now)),
          page: live((members, filter, now, after, span) => members.page(filter, now, after, span)),
          revision: live((members) => members.revision()),
          setExpiry: live((members, uid, ms) => members.setExpiry(uid, ms)),
          remove: live((members, uid) => members.remove(uid)),
        },
        cache: cacheStore,
      }) || null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
