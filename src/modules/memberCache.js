/* ------------------------------------------------------------------
   The member's own membership record, kept between visits (v0.5.7,
   user brief: fewer Firebase reads).

   WHY THIS IS THE READ WORTH CACHING. The account page reads one
   document per signed in visit, which sounds cheap until you count who
   does it: every member, every time, and since 2026-08-25 every "Get
   the membership card" button on this site lands here. It is the one
   read on this project that scales with PEOPLE rather than with the
   admin's browsing, so it is the one that decides whether a busy day
   can run out of free tier. The admin console's cache (src/admin.js)
   is the bigger multiple; this is the one that grows on its own.

   A HIT COSTS MORE THAN A READ, IT SAVES THE WHOLE SDK. accountAuth.js
   returns before openStore() is ever called, so Firestore Lite (33.2KB
   gz, the largest thing that page loads after Auth itself) is not
   fetched, parsed or run at all, and the card paints in the same frame
   as the name with no "checking" beat in between.

   THE TTL IS ASYMMETRIC BECAUSE THE TWO STATES ARE WAITING FOR
   DIFFERENT THINGS. A member with no membership, or an expired one, is
   waiting for one to appear and will reload to look, so their answer is
   held for minutes. A member with a running membership is waiting for
   nothing, since the only change that can matter to them is a
   revocation, so theirs is held for hours. And a record that was
   RUNNING when it was stored and is not running now is never served at
   all: that is precisely the moment a renewal would be sitting unseen
   behind an expired card, so it always costs a read.

   WHAT THIS TRADES, written down rather than discovered later. An admin
   action reaches a member's screen within the TTL rather than on their
   next visit, so a revocation or a deletion can leave a card showing
   for up to six hours. That card is honoured in person and not by this
   page, and the clock it is judged against was always the visitor's own
   (membership.js has the full note), so a stale entry buys exactly what
   a wound forward clock already bought: a picture. Nothing here is an
   authorization and nothing here is trusted by Firestore, which checks
   the signed in identity on every call it answers.

   IT IS localStorage AND NOT sessionStorage, which is the opposite
   choice to the admin console's and for the opposite reason. The whole
   value here is surviving BETWEEN visits, days apart, which a per tab
   store cannot do; and what is kept is one person's own name, address
   and expiry, which is theirs, on their machine, and which they are
   looking at on the screen anyway. The admin console keeps everybody
   else's, which is why that one is not allowed to touch a disk.
   ------------------------------------------------------------------ */
import { isActive, memberFrom } from '../data/membership.js';

const PREFIX = 'bss.member.v1.';

export const FRESH_ACTIVE_MS = 21600000; // 6 hours
export const FRESH_IDLE_MS = 600000; // 10 minutes

export function readCache(uid, now = Date.now()) {
  if (!uid) return null;
  try {
    const held = JSON.parse(localStorage.getItem(PREFIX + uid) || 'null');
    if (!held || typeof held.at !== 'number' || !held.record) return null;
    const age = now - held.at;
    if (age < 0) return null; // the clock moved backwards under it
    const live = isActive(held.record.expiresAt, now);
    // it was running when this was stored and has since run out: ask again
    if (held.record.expiresAt > held.at && !live) return null;
    if (age > (live ? FRESH_ACTIVE_MS : FRESH_IDLE_MS)) return null;
    /* Through memberFrom, so a hand edited entry cannot reach the panel as
       anything but the five fields it expects. Forging one is worth no more
       than winding the clock forward already was. */
    return memberFrom(uid, held.record);
  } catch {
    return null;
  }
}

export function writeCache(uid, record, now = Date.now()) {
  if (!uid) return;
  try {
    localStorage.setItem(PREFIX + uid, JSON.stringify({ at: now, record }));
  } catch {
    /* quota, or a privacy mode with no storage: the page works, it just pays
       the read it has always paid */
  }
}

export function dropCache(uid) {
  if (!uid) return;
  try {
    localStorage.removeItem(PREFIX + uid);
  } catch {
    /* nothing stored means nothing to remove */
  }
}
