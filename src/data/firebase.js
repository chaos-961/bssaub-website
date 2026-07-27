/* ------------------------------------------------------------------
   Firebase project config (v0.4.2, values supplied by the user).

   THIS IS NOT A SECRET, and treating it as one is the classic mistake.
   A Firebase web apiKey is a project IDENTIFIER, not a credential: it
   tells the Identity Toolkit which project a request belongs to, and
   Google publishes it in every quickstart for exactly that reason. It
   grants nothing on its own. What actually protects the project is
   configured in the console, not in this file, and those settings are
   the real security surface:

     1. Authorized domains (Authentication, Settings). Only origins on
        that list can complete a sign in. chaos-961.github.io must be on
        it, and the custom domain must be added the day it goes live or
        auth stops working there.
     2. Sign in providers. Email and Password must be enabled; every
        provider that is NOT deliberately in use should stay disabled,
        because an enabled provider is an open door whether or not this
        site has a button for it.
     3. Email enumeration protection (on by default for new projects),
        which is why the sign in path here reports one generic failure
        instead of distinguishing a wrong password from an unknown user.
     4. Security rules, once Firestore or the Realtime Database is
        actually used. Nothing here reads or writes data yet, so there is
        no rule surface today; the moment there is, "default deny, then
        allow by request.auth.uid" is the rule this file's UID feeds.

   So the honest summary: shipping this object is fine, and a locked down
   console is what keeps the project safe.
   ------------------------------------------------------------------ */
export const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyB1qziwwwgf7Qs9PgHwsuFjnIQUQ5SWoPI',
  authDomain: 'bssaub.firebaseapp.com',
  projectId: 'bssaub',
  storageBucket: 'bssaub.firebasestorage.app',
  messagingSenderId: '972676512936',
  appId: '1:972676512936:web:94e97f56980b2e981bd69d',
});
