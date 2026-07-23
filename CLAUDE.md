# BSS AUB Website

Rebuild of bssaub.com for the AUB Business Student Society. One goal drives every decision: get an AUB student to grab the membership card. Everything else (sponsors, story, animations) exists to make that decision feel obvious.

Repo: `https://github.com/chaos-961/bssaub-website.git` · Live: `https://chaos-961.github.io/bssaub-website/` (GitHub Pages via Actions; custom domain later).
Current version: **0.2.1**.

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

- `src/main.js` — init order matters: scroll → nav → auroraSky → heroCard → modal → perkField → journey → sponsorCta → footerVersion → `scroll.refresh()` → preloader last (it collects `[data-preload]` images the field creates).
- `src/data/sponsors.js` — single source of truth for every sponsor.
- `src/modules/*` — one module per concern; `src/styles/*` — tokens.css first, then per-section files.
- `public/assets/` — brand/, card/, sponsors/<category>/<id>.webp, journey/.
- Deploy: `.github/workflows/static.yml` (push to main → build → Pages). `vite.config.js` has `base: '/bssaub-website/'`. Custom-domain flip: CNAME in public/, base to `/`, revisit 404.html's absolute icon paths.
- Clean URLs (v0.1.3): internal links are extensionless (`account`, never `account.html`); Pages resolves them natively, and the `cleanUrls` middleware in `vite.config.js` (CLEAN_PAGES list) mirrors that in dev and preview. New pages join CLEAN_PAGES. Canonical and og:url use the extensionless form.
- Local run: `run-local.bat` (untracked, gitignored — user helper): opens the already-running server if 5173 is busy, else installs deps if needed and starts `vite --open`.

## Design system (dark gray "paper" ground with white ink since v0.2.1)

The theme has swung: light on the user's word (2026-07-23), a light aurora background (rotated CSS ray-line bands plus a WebGL shader curtain, `div.site-bg` first in `<body>`) rode from v0.1.0 to v0.1.8 through a reversed night-sky detour, then was deleted site wide (v0.1.9, 2026-07-24) for a plain `#ffffff` ground that ran to v0.2.0. On the user's word (v0.2.1, 2026-07-24) the ground flipped again to a darker gray "paper" sheet with white body text. `div.site-bg`, `src/styles/aurora.css`, and `src/modules/auroraSky.js` stay gone; do not reintroduce them without a fresh brief.

- Tokens in `src/styles/tokens.css` (`color-scheme: dark`): `--bg #2c2a2e` (dark gray paper; ran plain `#ffffff` v0.1.9 to v0.2.0, a warm `#fcfaf8` under the aurora v0.1.0 to v0.1.8) · `--surface #38353b` (raised panels) · `--surface-glass rgba(44,42,46,0.72)` (nav) · `--ink #ffffff` (14.2:1 on bg) · `--ink-soft #cfc7cd` (8.6:1) · `--line rgba(255,255,255,0.14)` · `--accent #cf3f5f` (a rose maroon lifted for dark: white button text 4.64:1, 3.07:1 on the ground, since the deep brand `#881532` read at only ~1.4:1 on the gray) · `--accent-strong #d64d68` · `--accent-2 #e79dac` (6.6:1). The old maroon glow rgbs `136,21,50` and `176,74,103` were swept to the lifted accent `207,63,95` and `231,157,172` so journey draws, modal, and perk sparks pop on dark; the dark ink shadows `34,18,25` were kept (they read as depth pools on the gray). The deep `#881532` now lives only in the maroon brand assets.
- Paper grain: a fixed `body::before` fractal-noise data URI (base.css, `saturate 0` grayscale, `mix-blend-mode: soft-light`, opacity 0.5, `z-index -1`). No image request, no JS, no animation, so reduced motion needs no exception; panels paint over it and it shows in the gaps. Dial the tooth with that one opacity.
- The navbar logo (`assets/brand/logo.webp`, brand maroon on transparent, went muddy at ~1.4:1 on the gray) carries `filter: brightness(1.5) saturate(1.06)` in nav.css so it floats to a vivid brand red on dark, hue intact. Sponsor bubble tiles are opaque coins whose marks contrast with their own baked field, so they read as is on dark (verified: even the darkest tiles carry light or bright marks). The preloader keeps the maroon brand curtain (`#290a13`, inline critical CSS in index.html) that now wipes up to reveal the dark page. OG image and favicons stay maroon brand assets.
- Type: Fraunces (display, `opsz 144`, WONK on hero/stub titles) + Instrument Sans (UI/body). Fluid clamp() scale lives in tokens.
- Motion: power2/power3-out reveals; elastic feel only inside the Perk Field; scrub only where scroll is the mechanic (field impulses, journey path). `prefers-reduced-motion` strips physics, tilt, and scroll effects sitewide; `?reduced-motion` URL param is the QA hook.

## The page (scroll order)

1. **Preloader** — honest progress (both font families + every `[data-preload]` image), 400ms floor, 4s hard cap, curtain wipe into the hero entrance.
2. **Navbar** — the real logo lockup top left (`assets/brand/logo.webp`, trimmed + white knocked to alpha from raw `assets/logo.png`, 42px tall, 34px under 360px); Account + hamburger right. Transparent over the hero, white glass after 80px, always visible (hide-on-scroll removed at v0.1.4, user call). The hamburger opens a compact dropdown anchored under the button (not a full panel): ESC, outside press, scroll movement, or tab-out closes it; no scroll lock.
3. **Hero** — headline "One card. A campus of perks.", membership CTA + "See the perks", trust row under the CTAs (+400 Active Members · +50 Industry Partners · Exclusive Member Benefits, user facts), 3D card: ink outline, pointer tilt ±12° with tracking glare and counter-moving shadow, idle float, gyro only where it needs no permission prompt.
4. **The Perk Field** — the signature section. 5 category zones, all 25 sponsors as physical DOM bubbles (real links/buttons, aria-labeled) in a zero-gravity Matter world: home springs, collisions, Lenis scroll impulses, pointer repulsor with stir currents, grab-and-glide-home, jelly squash-stretch, impact sparks, displacement clamps ("mixed but not too much"). Idle guardrail (v0.1.0): a hard travel ceiling (clampRadius + throwRange) projects collision-runaway bodies back so nothing slides under later sections; released bodies never reach it because they home on a timed glide instead. Return feel rebuilt again 2026-07-24 (user: releasing a far drag teleported the bubble onto the throw ring, then crawled it in): the sail/fling is gone. On release the body drops its momentum and its position is DRIVEN in `glidePass()` (post-`Engine.update`, so the spring's k·dist·dt² kick can't re-bury it) from the release point to home on a smoothstep over a fixed `returnMs` (~1s) — same duration near or far, zero velocity at both ends, no teleport. The homing body skips all spring/clamp/throw forces but still shoves neighbors aside via the soft-space loop and the collision solver, so it swims home through the crowd; `slop: 5` lets it squish into a crowded seat instead of being position-solver ejected ~40px. Idle bodies drifting home after a collision keep the older distance-eased radial glide (returnGlide/glideEase). Mobile: hold-to-grab 140ms, and long-press never opens the OS copy sheet (touch-callout/user-select on bubble descendants + a contextmenu preventDefault scoped to bubbles); quick taps still open Instagram/popups. Bubbles with a `details` object open the modal (focus trap, ESC, no-scroll layout tiers incl. landscape two-column); all others link straight to Instagram. Reduced motion: static cluster grid, physics never created.
5. **Our Journey** — one SVG path scrub-drawn through Story, Mission, Vision, Join. Desktop: chaotic bows and overshoot curls between checkpoints, guaranteed never over an image or text column (wander is index-hashed so geometry is stable across rebuilds and ignition prefixes cannot drift). Mobile: straight left rail, dots at measured image centers (JS sets y inline, CSS owns rail x). A glowing orb rides the draw front. Ignition (`.is-lit`) drives decorative state only — content reveals are once-only ScrollTriggers (`.is-in`) and can never un-reveal.
6. **Become a Sponsor** — stat row computed from sponsors.js so it never goes stale; CTA currently a mailto (interim until the Google Form URL arrives).
7. **Agency credit** — "Brought to you by" Nerve Media as its own quiet section before the footer since v0.1.2 (logo `assets/brand/nerve-media.webp` from nervemedia.agency, links there; user call 2026-07-23 — distinct from the still-standing Design Lab exclusion). One-shot reveal via `src/modules/agencyCredit.js`; account.html keeps the small footer-bar credit instead.
8. **Footer** — anchors, socials, mini CTA, version badge read from version.json. Bottom bar: "© Business Student Society, AUB · CRN: 5014".

`account.html`: "Member accounts are coming soon" placeholder sharing nav/footer, own entry (`src/account.js`) so a future auth system slots in without touching index. `404.html`: one line of personality + home button, ~1KB JS, served automatically by Pages.

## Sponsor data

One object in `src/data/sponsors.js` + one image = a new sponsor. Fields: `id`, `name`, `category` (restaurants | clothing | health-beauty | fitness | services), `discount` (string, or null to render badge-less with no % in the aria-label), `instagram`, `image`, `size` (relative bubble scale), and optional `details { summary, notes, steps, links }` — the presence of `details` is what turns a bubble into a popup instead of a direct link. Image filename equals the id: `assets/sponsors/<category>/<id>.webp`, about 320px square, ≤25KB.

## Budgets and floors

- LCP under 2.5s on throttled 4G (live median 1.91s measured at v0.0.2) · CLS ~0 (all media has reserved dimensions).
- JS ≤ 100KB gz (currently ~92.6, the aurora shader costs ~2.0) · card art ≤ 120KB · bubbles ≤ 25KB each.
- Accessibility: semantic landmarks, skip link, focus traps, visible focus everywhere, every bubble labeled ("Name, 20% OFF, opens Instagram"), token pairs hold AA+ contrast on the white ground.

## Open items owed by the user

- **7 sponsor discounts** (these ship badge-less until confirmed): sushi-bell 15%? · craves-burger 10%? · fattouh 20%? · munchease-diner 20%? · joy-of-beirut 10%? · dentspa-dr-rabah ? · the-kalm-studio ?. Each is a one-field edit in sponsors.js; the badge appears automatically. (Dunkin' resolved 2026-07-23: 10% plus popup steps, shipped.)
- **Become-a-Sponsor Google Form URL** (CTA runs on the mailto until then).

Design Lab stays excluded entirely (user lock; zero credits anywhere on the site). The old bssaub.com is down — verify anything missing via web search or the user, never by scraping it.

## Key links

Membership form `https://forms.cloud.microsoft/r/d5fFFxbKKN` · McDonald's activation `https://forms.office.com/r/NDXGRbdcBs` · IG `@businessstudentsociety` · `aubbusinesssociety@gmail.com`
