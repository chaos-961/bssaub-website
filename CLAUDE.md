# BSS AUB Website

Rebuild of bssaub.com for the AUB Business Student Society. One goal: get an AUB student to grab
the membership card; sponsors, story and animations all serve that.

Repo `github.com/chaos-961/bssaub-website` (branch `main`) · Live
`https://chaos-961.github.io/bssaub-website/` (Pages via Actions, custom domain not yet flipped) ·
Version in `version.json`, currently 0.6.2.

## Stack

Vanilla JS on Vite 6, seven pages (index, account, admin, privacy, cookies, terms, 404). GSAP +
ScrollTrigger, Lenis, Matter.js. Firebase Auth + Firestore Lite on account and admin only, every
piece behind a dynamic import. Self hosted `@fontsource-variable` Roboto Condensed (display) +
Instrument Sans (body). No other runtime deps, zero third party scripts.

## Layout

- Entries, one per page, all standalone: `main.js` (index), `account.js`, `admin.js`, `page.js`
  (404 only), `legal.js` (the three policy pages, no GSAP/Lenis/Matter, the one entry that imports
  `page.js`).
- `src/modules/*` one file per concern · `src/styles/*` with `tokens.css` first · `src/data/`
  sponsors, names, membership, firebase config (public by design) · `src/admin/dashboard.{html,js}`
  plaintext, shipped only as ciphertext.
- `firestore.rules` is gitignored (it names the admin address; the console is where rules live), as
  is root `/assets/`, the raw uploads.

## Commands

```
npm run dev              # vite, port 5173 strict, at /bssaub-website/
npm run build            # admin payload gate, then vite build to dist/  (also: preview)
npm run admin:check      # verify a password against the shipped payload, writes nothing
npm run admin:payload    # re-encrypt the dashboard into public/admin-payload.json
node scripts/generate-bg-mesh.mjs [#hex]   # regen mesh.svg (seeded, refuses on contrast fail)
node scripts/check-swell.mjs               # motion gate, 240s sweep desktop + capped mobile
```

`run-local.bat` (untracked) reuses 5173 if busy, else installs and opens.

## Architecture

- The init order in `main.js` is load bearing: `reveal` follows perkField and journey because its
  triggers measure what those laid out, then `scroll.refresh()`, preloader last. `initPerkField`
  is async (Matter.js is a lazy chunk) but its `await` sits after the DOM build, layout and the
  reduced motion return, so only physics resumes late.
- The background is one mesh in two forms: the static SVG is the animation's rest state, the WebGL
  canvas (`oceanMesh.js`) animates the same lattice on top and crossfades in only after frame zero,
  so any drift between them shows as a jump. `src/lib/mesh.js` owns geometry, palette, drift, swell
  and contrast maths for generator, harness and runtime. `mesh.svg` lives in `src/`, not `public/`,
  so Vite hashes it and rewrites the `url()` base; a `public/` copy would hardcode the base and
  break the domain flip.
- CSP is injected at build time by a `vite.config.js` plugin, account and admin only, switched on
  `ctx.bundle`: Vite's dev server serves an inline HMR script a source `script-src 'self'` meta tag
  would kill. Neither gated page carries an inline `<script>`, and since a meta CSP ignores
  `frame-ancestors`, clickjacking is the frame bust in `src/admin.js`.
- Internal links are extensionless and never end in a slash (`privacy`, not `privacy/`); only the
  root keeps its `/`. `cleanUrls` in `vite.config.js` gives dev and preview what Pages does
  natively. A new page registers once, in `INPUT`, which feeds `rollupOptions.input`, the
  `CLEAN_PAGES` dev rewrite, and the slash redirect that is the first script in `404.html`
  (GitHub Pages cannot redirect server side, so `/privacy/` lands on 404.html and is swapped
  for `/privacy` there). Pages stay flat `name.html`; never add a `dir/index.html` page.
- Sponsors: one object in `src/data/sponsors.js` plus one image is a new sponsor. Filename equals
  the id at `assets/sponsors/<category>/<id>.webp`, ~320px square, 25KB or under. A `details`
  object turns a bubble into a popup instead of a direct link.

## Deploy

Push to `main` runs `.github/workflows/static.yml`: npm ci, build, upload `dist/`, deploy to Pages.
Push authorization is deploy authorization, say so before pushing.

Per authorized push:
1. Bump `version.json` by +0.0.1 (carry 0.0.9 to 0.1.0).
2. Sync the six static badge fallbacks: index, 404, account, privacy, cookies and terms footers
   (`admin.html` has none).
3. If `src/admin/dashboard.html` or `dashboard.js` changed at any point in the session, run
   `npm run admin:payload` before committing.
4. Commit message `v0.6.1: short description`.

Custom domain flip: CNAME in `public/`, `base` to `/` in `vite.config.js`, 404.html's absolute icon
paths, then every absolute origin a grep for `chaos-961.github.io` finds: `public/robots.txt`,
`sitemap.xml`, `llms.txt` (5), index.html's JSON-LD, canonical, og:url, og:image and its
`rel="alternate"` llms.txt link, account.html's canonical, og:url and og:image, plus canonical and
og:url on privacy, cookies, terms.

## Project rules

- Git gate: never commit or push unless the user says so this session. "Looks good" is not it.
- No invented data. Discounts, Instagram links, redemption steps are never guessed. Unknown means
  blocked and listed.
- No hyphens or dashes in user visible copy. Em dashes become commas, colons or periods; titles
  join with "·"; compounds get rephrased. Applies to text, aria-labels, alt, titles, meta.
- File edits go through the Edit/Write tools only. PowerShell 5.1 text operations mojibake UTF-8.
- Headless covers logic, geometry and colour. Feel checks on real hardware are the user's.
- Never hand edit `src/assets/bg/mesh.svg` or `swell()` inside `oceanMesh.js`; both are generated
  from `src/lib/mesh.js`.
- After touching `AMP`, `SWELL`, `MESH` or `PALETTE_CYCLE`, re-run both gates: the generator (which
  refuses to write on a contrast failure) and `scripts/check-swell.mjs`. `DEFAULT_BASE` must equal
  `PALETTE_CYCLE[0]`, but that is checked only inside `generate-bg-mesh.mjs`, never at build time:
  skip the rerun and the drift ships silently.
- Contrast is measured against the darkest facet rendered anywhere in the animated cycle, not
  against white and not against the still: per facet scatter pushes triangles below the gradient
  stops. `--ink-soft` is binding, floor 4.5:1.
- JS budget 256KB gz on index, quoting total and blocking separately (v0.5.7 baseline: 96.1 total,
  69.1 blocking). Do not read a changed chunk filename or a moved number as a regression; measure
  the page.
- The old bssaub.com is down. Verify anything missing via the user or a search, never by scraping.
- Design Lab stays excluded (user lock, zero credits on the site).
- Do not reintroduce without a fresh brief, all removed on the user's word, all in history: the
  aurora background, the generative starfield (pull it from
  `C:\Development\Website Templates\Background Constellation` if asked, do not rebuild it), the
  hero only WebGL caustic background, the dev only `COLORS` picker panel.
- No cookie consent banner. Measured, not assumed: the only cookie is `bss_member`, a display name
  hint written after sign in, exempt as strictly necessary. The cookies page states why.

## Gotchas

- A forgotten `npm run admin:payload` ships a gate that unlocks into the previous dashboard with no
  error anywhere. `check-admin-payload.mjs` hashes sources, so it catches changed code but never a
  changed `BSS_ADMIN_EMAIL`: that is why re-encrypting is a push rule and not just a build gate.
- Run `npm run admin:check` before encrypting with a password you are not certain of. A
  misremembered one is silent: the payload opens for that secret, the build gate passes, and it
  surfaces only as a deployed admin that unlocks then cannot reach Firestore. Not wired into
  `npm run build`, which stays password free for CI.
- Admin credentials (`BSS_ADMIN_PASSWORD`, `BSS_ADMIN_EMAIL`) live in gitignored `.admin.env`,
  loaded by node's `--env-file-if-exists`. Check it before asking the user. Not named `.env.*` on
  purpose: Vite's env loader would claim it.
- Never add a per frame `getBoundingClientRect` to `oceanMesh.js` or `perkField.js`. Sizing is a
  debounced `ResizeObserver` and must be: the fixed layer changes width by the scrollbar once the
  perk field grows the page, and no window `resize` event reports that.

## Open items owed by the user (none doable from here)

- Firebase console, before `/account` works in production: Authentication, Settings, Authorized
  domains, add `chaos-961.github.io` plus the custom domain the day it lands. Providers not in
  deliberate use stay disabled. The first real account is the user's to create.
- Firestore console: create the database, create the admin account in Authentication > Users with
  the address in `BSS_ADMIN_EMAIL` **and the same password that encrypts the payload** (`admin.js`
  feeds the string that unlocked the gate into `signInWithEmailAndPassword`: any other password
  unlocks the dashboard then cannot reach Firestore), publish the local `firestore.rules` with
  `ADMIN_EMAIL` replaced. **Re-paste the rules for v0.5.7**: the file gained a `match /meta/members`
  block the read cache hangs off, and until it is pasted that marker is permission denied with no
  error anywhere on screen.
- `salon-beyrouth`: the live site reportedly shows 10% OFF, sponsors.js carries 15%. 15% ships
  pending a user call.
- Become a Sponsor Google Form URL. The CTA runs on a mailto until it arrives.
- A LinkedIn page for the society, if one exists (index.html JSON-LD `sameAs` plus the footer
  Connect column; a guessed URL is a claim, not a link), and a vector master for the logo (the
  only master is a raster, so brand assets are capped at the size someone exported once).
- Submit the sitemap in Google Search Console (only the user can sign in).
- Email verification is not enforced: nothing is gated on sign in yet. The moment member only
  content lands, `sendEmailVerification` plus an `emailVerified` gate is first.

## Reference

Membership form `https://forms.cloud.microsoft/r/d5fFFxbKKN` · IG `@businessstudentsociety` ·
`aubbusinesssociety@gmail.com`. `docs/HISTORY.md` (194KB) holds the v0.3.6 to v0.5.9 changelog and
the design system reasoning: grep it for a why, never read it whole.

## The admin

`/admin`, no trailing slash, and the same URL, the same sign-in card, the same top bar, the same
tab strip and the same footer on all eight sites in this family. The page is ONE file with its
stylesheet inline, so the gate paints in a single response; the dashboard, its styles and whatever
back end it speaks to are fetched only after the password is accepted, which means a visitor who
cannot sign in downloads the door and nothing behind it.

**Nothing is remembered.** No storage is written, no session is resumed, and signing out reloads
the page rather than tearing it down, so opening `/admin` always asks for the password. Any back
end that would restore itself is asked for in-memory persistence.

The page and its shell script are GENERATED from one source shared across the estate: editing
either by hand puts this site out of step with its siblings and is overwritten on the next run.
What belongs to this site is its adapter (`signIn`, `mount`, `signOut`) and whatever the adapter
mounts into the tabs. The first tab is Overview, everywhere.

BSS's two tabs are Overview (the register in three numbers, three counts and no more) and Members.
`src/admin.js` is the entry and is three things: the faces, the ground, and the shared shell.
Everything else - `public/admin-payload.json`, the crypto, Firebase, the member console - lives in
`src/admin-boot.js`, which the shell imports on the first submit, so Vite splits it into its own
chunk and a visitor who cannot sign in downloads none of it.

`admin.html` is a Vite build input and is generated from the shared template, so Vite rewrites its
asset URLs for the project base and injects the built CSP. The clickjacking guard moved into the
shell with everything else: a meta CSP cannot express `frame-ancestors`, so the page refuses to
render inside a frame and tries to break out.
