# BSS AUB Website

Rebuild of bssaub.com for the AUB Business Student Society. One goal drives every decision: get an AUB student to grab the membership card. Everything else (sponsors, story, animations) exists to make that decision feel obvious.

Repo: `https://github.com/chaos-961/bssaub-website.git` · Live: `https://chaos-961.github.io/bssaub-website/` (GitHub Pages via Actions; custom domain later).
Current version: **0.1.5**.

## Rules (standing, no exceptions)

1. **Git gate.** Never commit or push unless the user explicitly says commit or push in that session. "Looks good" is not authorization. Every push to `main` auto-deploys — treat push authorization as deploy authorization and say so.
2. **Version contract.** Bump `version.json` by +0.0.1 as part of each authorized push (base-10 carry: 0.0.9 → 0.1.0). Keep the three static badge fallbacks (index/account/404 footers) in sync with it. Commit message format: `v0.1.3: short description`.
3. **No invented data.** Discounts, Instagram links, and redemption steps are never guessed. Unknown means blocked and listed, never filled with plausible garbage. Nothing marked "?" ever ships.
4. **No hyphens or dashes in user-visible copy.** Em dashes become commas, colons, or periods; titles join with "·"; compounds get rephrased ("hub led by students", not "student-led hub"). Applies to text nodes, aria-labels, alt text, titles, and meta.
5. **File content edits via the Edit/Write tools only.** PowerShell 5.1 text operations mojibake UTF-8.
6. **Feel checks on real hardware are the user's.** Headless verification covers logic, geometry, and colors; 60fps judgment is theirs.
7. **Session protocol.** Read this file, state version + open items in a line or two, await instruction. A user request is its own authorization — the rules stop AI initiative, not user freedom. Keep the version line and Open items section here current as work ships.

## Stack and shape

Vanilla JS + Vite 6 multi-page (`index.html`, `account.html`, `404.html`) · GSAP + ScrollTrigger · Lenis smooth scroll · Matter.js physics · Fraunces + Instrument Sans (self-hosted variable woff2). No other runtime deps, zero third-party scripts.

- `src/main.js` — init order matters: scroll → nav → heroCard → modal → perkField → journey → sponsorCta → footerVersion → `scroll.refresh()` → preloader last (it collects `[data-preload]` images the field creates).
- `src/data/sponsors.js` — single source of truth for every sponsor.
- `src/modules/*` — one module per concern; `src/styles/*` — tokens.css first, then per-section files.
- `public/assets/` — brand/, card/, sponsors/<category>/<id>.webp, journey/.
- Deploy: `.github/workflows/static.yml` (push to main → build → Pages). `vite.config.js` has `base: '/bssaub-website/'`. Custom-domain flip: CNAME in public/, base to `/`, revisit 404.html's absolute icon paths.
- Clean URLs (v0.1.3): internal links are extensionless (`account`, never `account.html`); Pages resolves them natively, and the `cleanUrls` middleware in `vite.config.js` (CLEAN_PAGES list) mirrors that in dev and preview. New pages join CLEAN_PAGES. Canonical and og:url use the extensionless form.
- Local run: `run-local.bat` (untracked, gitignored — user helper): opens the already-running server if 5173 is busy, else installs deps if needed and starts `vite --open`.

## Design system (light theme since v0.0.9, light aurora since v0.1.0, ribbon aurora since v0.1.5)

The site went light on the user's word (2026-07-23); the old dark background system (aurora canvas, ground washes, film grain) is deleted for good — do not resurrect it. The background is `src/styles/aurora.css`, rebuilt at v0.1.5 to the user's ribbon spec (2026-07-23, superseding the v0.1.3/v0.1.4 intensity cranks — the new brief is "extremely subtle, still reads cream/white at first glance"; if it vanishes on real hardware again, the fix is raising the four field alphas in place, not new structure). Shape: ONE `div.site-bg` first in `<body>` on all three pages (`position: fixed; inset: 0; z-index: -1; pointer-events: none`), every field stacked as `background-image` on that single element over the solid `#fcfaf8` ground — a cream veil, a dusty rose ribbon top left, the brand maroon ribbon upper right (`rgb(136 21 50)` sampled from the CTA), a warm champagne core near center, a soft mauve wash bottom left. Chroma sits in corners and edges, the center stays calm; every field is fully transparent by 65-68% of its radius through eased interior stops (no banding), no layer over 0.12 alpha, sizes in vmax/% only so it scales 360px to 4K with zero media queries. No images, no `filter: blur`, no JS, no canvas, no `background-attachment: fixed` (iOS). Motion: one 120s transform-only drift of the whole element (base `scale(1.05)` is the overscan so edges never show); reduced motion (OS setting or `?reduced-motion`, which the inline head script stamps as `html.reduced-motion`) freezes the drift but keeps the tint, and the static frame is the designed composition. Grain overlay deliberately skipped (no-images rule; the old film grain stays deleted). Readability floor (grid sweep, six viewports, worst composite `rgb(243 232 231)`): `--ink` 15.0:1, `--accent` 8.0:1, `--ink-soft` 6.8:1, pure black 17.6:1.

- Tokens in `src/styles/tokens.css`: `--bg #fcfaf8` (warmed from pure white at v0.1.0 to match the aurora ground) · `--surface #f8f3f5` · `--ink #221219` · `--ink-soft #5f4a54` (8.1:1 on white) · `--accent #881532` (brand maroon extracted from the logo, 9.55:1 on white) · `--accent-strong #a31a3c` · `--accent-2 #b04a67` (deep rose, 5.2:1 — deepened from the dark-theme `#e18ba1` so it reads on white).
- The preloader keeps the maroon brand curtain (`#290a13`, inline critical CSS in index.html) that wipes up to reveal the white page. OG image and favicons stay maroon brand assets.
- Type: Fraunces (display, `opsz 144`, WONK on hero/stub titles) + Instrument Sans (UI/body). Fluid clamp() scale lives in tokens.
- Motion: power2/power3-out reveals; elastic feel only inside the Perk Field; scrub only where scroll is the mechanic (field impulses, journey path). `prefers-reduced-motion` strips physics, tilt, and scroll effects sitewide; `?reduced-motion` URL param is the QA hook.

## The page (scroll order)

1. **Preloader** — honest progress (both font families + every `[data-preload]` image), 400ms floor, 4s hard cap, curtain wipe into the hero entrance.
2. **Navbar** — the real logo lockup top left (`assets/brand/logo.webp`, trimmed + white knocked to alpha from raw `assets/logo.png`, 42px tall, 34px under 360px); Account + hamburger right. Transparent over the hero, white glass after 80px, always visible (hide-on-scroll removed at v0.1.4, user call). The hamburger opens a compact dropdown anchored under the button (not a full panel): ESC, outside press, scroll movement, or tab-out closes it; no scroll lock.
3. **Hero** — headline "One card. A campus of perks.", membership CTA + "See the perks", trust row under the CTAs (+400 Active Members · +50 Industry Partners · Exclusive Member Benefits, user facts), 3D card: ink outline, pointer tilt ±12° with tracking glare and counter-moving shadow, idle float, gyro only where it needs no permission prompt.
4. **The Perk Field** — the signature section. 5 category zones, all 25 sponsors as physical DOM bubbles (real links/buttons, aria-labeled) in a zero-gravity Matter world: home springs, collisions, Lenis scroll impulses, pointer repulsor with stir currents, grab-and-throw with velocity fling, jelly squash-stretch, impact sparks, displacement clamps ("mixed but not too much"). Throw guardrails (v0.1.0, user report): a hard travel ceiling (clampRadius + throwRange) projects runaway bodies back so a fling can never slide under later sections, and a returnGlide cap trims homeward radial speed beyond the clamp radius so the comeback glides instead of snapping. Bubbles with a `details` object open the modal (focus trap, ESC, no-scroll layout tiers incl. landscape two-column); all others link straight to Instagram. Reduced motion: static cluster grid, physics never created.
5. **Our Journey** — one SVG path scrub-drawn through Story, Mission, Vision, Join. Desktop: chaotic bows and overshoot curls between checkpoints, guaranteed never over an image or text column (wander is index-hashed so geometry is stable across rebuilds and ignition prefixes cannot drift). Mobile: straight left rail, dots at measured image centers (JS sets y inline, CSS owns rail x). A glowing orb rides the draw front. Ignition (`.is-lit`) drives decorative state only — content reveals are once-only ScrollTriggers (`.is-in`) and can never un-reveal.
6. **Become a Sponsor** — stat row computed from sponsors.js so it never goes stale; CTA currently a mailto (interim until the Google Form URL arrives).
7. **Agency credit** — "Brought to you by" Nerve Media as its own quiet section before the footer since v0.1.2 (logo `assets/brand/nerve-media.webp` from nervemedia.agency, links there; user call 2026-07-23 — distinct from the still-standing Design Lab exclusion). One-shot reveal via `src/modules/agencyCredit.js`; account.html keeps the small footer-bar credit instead.
8. **Footer** — anchors, socials, mini CTA, version badge read from version.json. Bottom bar: "© Business Student Society, AUB · CRN: 5014".

`account.html`: "Member accounts are coming soon" placeholder sharing nav/footer, own entry (`src/account.js`) so a future auth system slots in without touching index. `404.html`: one line of personality + home button, ~1KB JS, served automatically by Pages.

## Sponsor data

One object in `src/data/sponsors.js` + one image = a new sponsor. Fields: `id`, `name`, `category` (restaurants | clothing | health-beauty | fitness | services), `discount` (string, or null to render badge-less with no % in the aria-label), `instagram`, `image`, `size` (relative bubble scale), and optional `details { summary, notes, steps, links }` — the presence of `details` is what turns a bubble into a popup instead of a direct link. Image filename equals the id: `assets/sponsors/<category>/<id>.webp`, about 320px square, ≤25KB.

## Budgets and floors

- LCP under 2.5s on throttled 4G (live median 1.91s measured at v0.0.2) · CLS ~0 (all media has reserved dimensions).
- JS ≤ 100KB gz (currently ~90.4) · card art ≤ 120KB · bubbles ≤ 25KB each.
- Accessibility: semantic landmarks, skip link, focus traps, visible focus everywhere, every bubble labeled ("Name, 20% OFF, opens Instagram"), token pairs hold AA+ contrast on the white ground.

## Open items owed by the user

- **7 sponsor discounts** (these ship badge-less until confirmed): sushi-bell 15%? · craves-burger 10%? · fattouh 20%? · munchease-diner 20%? · joy-of-beirut 10%? · dentspa-dr-rabah ? · the-kalm-studio ?. Each is a one-field edit in sponsors.js; the badge appears automatically. (Dunkin' resolved 2026-07-23: 10% plus popup steps, shipped.)
- **Become-a-Sponsor Google Form URL** (CTA runs on the mailto until then).

Design Lab stays excluded entirely (user lock; zero credits anywhere on the site). The old bssaub.com is down — verify anything missing via web search or the user, never by scraping it.

## Key links

Membership form `https://forms.cloud.microsoft/r/d5fFFxbKKN` · McDonald's activation `https://forms.office.com/r/NDXGRbdcBs` · IG `@businessstudentsociety` · `aubbusinesssociety@gmail.com`
