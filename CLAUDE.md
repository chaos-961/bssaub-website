# BSS AUB Website

Rebuild of bssaub.com for the AUB Business Student Society. One goal drives every decision: get an AUB student to grab the membership card. Everything else (sponsors, story, animations) exists to make that decision feel obvious.

Repo: `https://github.com/chaos-961/bssaub-website.git` · Live: `https://chaos-961.github.io/bssaub-website/` (GitHub Pages via Actions; custom domain later).
Current version: **0.0.9**.

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

## Design system (white theme since v0.0.9)

The site went light on the user's word (2026-07-23): plain white ground, background system deleted entirely (the old aurora canvas, ground washes, and film grain are gone — do not resurrect them).

- Tokens in `src/styles/tokens.css`: `--bg #ffffff` · `--surface #f8f3f5` · `--ink #221219` · `--ink-soft #5f4a54` (8.1:1 on white) · `--accent #881532` (brand maroon extracted from the logo, 9.55:1 on white) · `--accent-strong #a31a3c` · `--accent-2 #b04a67` (deep rose, 5.2:1 — deepened from the dark-theme `#e18ba1` so it reads on white).
- The preloader keeps the maroon brand curtain (`#290a13`, inline critical CSS in index.html) that wipes up to reveal the white page. OG image and favicons stay maroon brand assets.
- Type: Fraunces (display, `opsz 144`, WONK on hero/stub titles) + Instrument Sans (UI/body). Fluid clamp() scale lives in tokens.
- Motion: power2/power3-out reveals; elastic feel only inside the Perk Field; scrub only where scroll is the mechanic (field impulses, journey path). `prefers-reduced-motion` strips physics, tilt, and scroll effects sitewide; `?reduced-motion` URL param is the QA hook.

## The page (scroll order)

1. **Preloader** — honest progress (both font families + every `[data-preload]` image), 400ms floor, 4s hard cap, curtain wipe into the hero entrance.
2. **Navbar** — wordmark left; Account + hamburger right. Transparent over the hero, white glass after 80px, hides scrolling down, returns scrolling up. The hamburger opens a compact dropdown anchored under the button (not a full panel): ESC, outside press, scroll movement, or tab-out closes it; no scroll lock.
3. **Hero** — headline "One card. A campus of perks.", membership CTA + "See the perks", 3D card: pointer tilt ±12° with tracking glare and counter-moving shadow, idle float, gyro only where it needs no permission prompt.
4. **The Perk Field** — the signature section. 5 category zones, all 25 sponsors as physical DOM bubbles (real links/buttons, aria-labeled) in a zero-gravity Matter world: home springs, collisions, Lenis scroll impulses, pointer repulsor with stir currents, grab-and-throw with velocity fling, jelly squash-stretch, impact sparks, displacement clamps ("mixed but not too much"). Bubbles with a `details` object open the modal (focus trap, ESC, no-scroll layout tiers incl. landscape two-column); all others link straight to Instagram. Reduced motion: static cluster grid, physics never created.
5. **Our Journey** — one SVG path scrub-drawn through Story, Mission, Vision, Join. Desktop: chaotic bows and overshoot curls between checkpoints, guaranteed never over an image or text column (wander is index-hashed so geometry is stable across rebuilds and ignition prefixes cannot drift). Mobile: straight left rail, dots at measured image centers (JS sets y inline, CSS owns rail x). A glowing orb rides the draw front. Ignition (`.is-lit`) drives decorative state only — content reveals are once-only ScrollTriggers (`.is-in`) and can never un-reveal.
6. **Become a Sponsor** — stat row computed from sponsors.js so it never goes stale; CTA currently a mailto (interim until the Google Form URL arrives).
7. **Footer** — anchors, socials, mini CTA, version badge read from version.json.

`account.html`: "Member accounts are coming soon" placeholder sharing nav/footer, own entry (`src/account.js`) so a future auth system slots in without touching index. `404.html`: one line of personality + home button, ~1KB JS, served automatically by Pages.

## Sponsor data

One object in `src/data/sponsors.js` + one image = a new sponsor. Fields: `id`, `name`, `category` (restaurants | clothing | health-beauty | fitness | services), `discount` (string, or null to render badge-less with no % in the aria-label), `instagram`, `image`, `size` (relative bubble scale), and optional `details { summary, notes, steps, links }` — the presence of `details` is what turns a bubble into a popup instead of a direct link. Image filename equals the id: `assets/sponsors/<category>/<id>.webp`, about 320px square, ≤25KB.

## Budgets and floors

- LCP under 2.5s on throttled 4G (live median 1.91s measured at v0.0.2) · CLS ~0 (all media has reserved dimensions).
- JS ≤ 100KB gz (currently ~90.4) · card art ≤ 120KB · bubbles ≤ 25KB each.
- Accessibility: semantic landmarks, skip link, focus traps, visible focus everywhere, every bubble labeled ("Name, 20% OFF, opens Instagram"), token pairs hold AA+ contrast on the white ground.

## Open items owed by the user

- **8 sponsor discounts** (these ship badge-less until confirmed): sushi-bell 15%? · craves-burger 10%? · fattouh 20%? · munchease-diner 20%? · joy-of-beirut 10%? · dunkin ? · dentspa-dr-rabah ? · the-kalm-studio ?. Each is a one-field edit in sponsors.js; the badge appears automatically.
- **Dunkin' popup redemption details.**
- **Become-a-Sponsor Google Form URL** (CTA runs on the mailto until then).

Design Lab stays excluded entirely (user lock; zero credits anywhere on the site). The old bssaub.com is down — verify anything missing via web search or the user, never by scraping it.

## Key links

Membership form `https://forms.cloud.microsoft/r/d5fFFxbKKN` · McDonald's activation `https://forms.office.com/r/NDXGRbdcBs` · IG `@businessstudentsociety` · `aubbusinesssociety@gmail.com`
