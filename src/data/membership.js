/* ------------------------------------------------------------------
   Membership record shape and its arithmetic (v0.4.8, user brief: the
   admin subscribes a member by the month, the account page shows the card
   only while that subscription is still running).

   THIS FILE IMPORTS NOTHING, AND THAT IS THE POINT. Three consumers need
   the same answers and none of them can share a bundle with the others:
   the account page (which loads Firestore lazily behind Firebase Auth),
   src/admin.js (which loads both only after the payload has decrypted),
   and the admin DASHBOARD, which is a blob module with no bundler behind
   it and therefore cannot import anything at all. Keeping the maths pure
   means admin.js can hand this straight to the dashboard through `api`
   instead of the two drifting apart, which is the only way "days left" on
   one screen can be trusted to mean the same thing as "days left" on the
   other.

   THE RECORD, members/{uid}, five fields and no more:
     name        the display name, exactly as the member typed it
     email       their sign in address, for the admin to search by
     searchKeys  the prefix index below, so a name search is ONE query
     expiresAt   epoch ms. 0 means no membership has ever been granted.
     createdAt   epoch ms, written once

   WHO MAY WRITE WHAT is enforced in the Firestore rules, not here: a
   member may create and correct their own row but can never move
   expiresAt, and only the admin account can write that field, delete a
   row, or list the collection. Everything in this file is arithmetic; the
   authority lives in the console.

   THE CLOCK IS THE VISITOR'S, and that is a known, bounded weakness. A
   member who winds their own machine forward can reveal their own card
   after it has lapsed. What that buys them is a picture of a card they
   already had and a link to a form that is public on every page of this
   site: the card is honoured in person, not by this page, so there is
   nothing behind the gate worth forging a clock for. Reading a trusted
   time would mean a server, which this site does not have.
   ------------------------------------------------------------------ */

export const MEMBERS = 'members';

export const DAY_MS = 86400000;

/* Prefix search, sized. Every prefix of every word in a name is stored, so
   "khal" finds "Ahmad Khalil" with a single array-contains query and NO
   composite index (which matters: a composite index is a console step, and
   this feature is meant to work the moment the rules are pasted in). The two
   caps keep the array small on a pathological name; 16 characters is past the
   point where a prefix stops narrowing anything. */
const PREFIX_MAX = 16;
const KEYS_MAX = 60;

/* Lowercase, strip accents, collapse whitespace. Accents come off so that
   searching "jose" finds "José" — the admin is typing from memory, not
   copying from the record. Stored keys and typed terms both go through this,
   which is the only reason the two can ever meet. */
export function normalize(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokensOf(name) {
  const clean = normalize(name);
  return clean ? clean.split(' ') : [];
}

export function searchKeysFor(name) {
  const keys = new Set();
  for (const token of tokensOf(name)) {
    const capped = token.slice(0, PREFIX_MAX);
    for (let i = 1; i <= capped.length; i += 1) {
      if (keys.size >= KEYS_MAX) return Array.from(keys);
      keys.add(capped.slice(0, i));
    }
  }
  return Array.from(keys);
}

/* The one key a search term turns into. A multi word term queries on its
   FIRST word and the rest is settled by matchesTerm below, because Firestore
   allows one array-contains per query and a second one would need a composite
   index for nothing: the first word already cuts the result set to a handful. */
export function queryKeyFor(term) {
  const [first = ''] = tokensOf(term);
  return first.slice(0, PREFIX_MAX);
}

/* Client side exactness on top of the query, which is deliberately loose.
   Every word typed must be the start of some word in the name, in any order,
   so "khalil ahmad" finds "Ahmad Khalil" and "ahmad z" does not. */
export function matchesTerm(name, term) {
  const words = tokensOf(name);
  return tokensOf(term).every((part) => words.some((word) => word.startsWith(part)));
}

/* --- the calendar ------------------------------------------------------ */

/* Calendar months, not 30 day blocks, because "+1 month" on the 15th has to
   land on the 15th or the admin cannot tell a member when their card runs out.
   The setDate(1) first is what stops the classic overflow: adding a month to
   31 January would otherwise roll through a 28 day February into 3 March. */
export function addMonths(from, months) {
  const date = new Date(from);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastOfMonth));
  return date.getTime();
}

/* What a subscribe or unsubscribe button does to a record.

   Adding runs from whichever is later, now or the current expiry, so renewing
   an active member extends them and renewing a lapsed one starts them today
   rather than backdating a month they never had.

   Taking away runs from the expiry itself, and anything that lands in the past
   collapses to 0. Keeping the field to "0 or a future instant" means every
   consumer can read it as one question instead of two. */
export function extend(expiresAt, months, now = Date.now()) {
  const current = Number(expiresAt) || 0;
  if (months >= 0) return addMonths(Math.max(now, current), months);
  if (current <= now) return 0;
  const next = addMonths(current, months);
  return next > now ? next : 0;
}

/* Strictly greater than, to the millisecond, which is the user's own line:
   the card goes the instant the subscription has literally nothing left, not
   when the day counter happens to reach zero. */
export function isActive(expiresAt, now = Date.now()) {
  return (Number(expiresAt) || 0) > now;
}

export function msLeft(expiresAt, now = Date.now()) {
  return Math.max(0, (Number(expiresAt) || 0) - now);
}

export function daysLeft(expiresAt, now = Date.now()) {
  return Math.ceil(msLeft(expiresAt, now) / DAY_MS);
}

/* Days is what the brief asked for and days is what this says almost always.
   The last day is the exception, deliberately: rounding 40 minutes up to
   "1 day left" is the reading that would let someone walk into a restaurant on
   a card that had already gone. Below a day it counts down in the unit that is
   actually left. */
export function formatLeft(expiresAt, now = Date.now()) {
  const left = msLeft(expiresAt, now);
  if (!left) return 'Expired';
  const days = Math.ceil(left / DAY_MS);
  if (days > 1) return `${days} days left`;
  const hours = Math.ceil(left / 3600000);
  if (hours > 1) return `${hours} hours left`;
  const minutes = Math.ceil(left / 60000);
  if (minutes > 1) return `${minutes} minutes left`;
  return 'Less than a minute left';
}

/* "28 Aug 2026". en-GB rather than the visitor's locale so the month is always
   a word: a numeric date is 03/08 in half the world and 08/03 in the other
   half, and a membership end date is exactly the kind of number nobody should
   have to guess at. No hyphens in it either (§ rule 4). */
export function formatDate(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/* The row every consumer works with, built from a Firestore snapshot. Reading
   it through one function is what keeps a missing or half written document
   from reaching the UI as undefined. */
export function memberFrom(uid, data = {}) {
  return {
    uid,
    name: typeof data.name === 'string' ? data.name : '',
    email: typeof data.email === 'string' ? data.email : '',
    expiresAt: Number(data.expiresAt) || 0,
    createdAt: Number(data.createdAt) || 0,
  };
}
