# BSS AUB Website: Build Plan & AI Operating Contract

Rebuild of bssaub.com for the AUB Business Student Society. One goal drives every decision: get an AUB student to grab the membership card. Everything else (sponsors, story, animations) exists to make that decision feel obvious.

This file is both the plan and the standing prompt. Any AI session working on this project reads this file first, obeys the rules in §1, and works only inside the currently authorized phase.

Repo: `https://github.com/chaos-961/bssaub-website.git`
Hosting: GitHub Pages via Actions (custom domain later).

---

## 0. STATUS (keep current)

- **Current phase:** all 5 phases shipped; **v0.0.7 pushed** (2026-07-23, push authorized in-message: "…push"). **New card art in** (user updated `assets/membership_card.png` → re-converted webp 663×473 + og-image regenerated + aspect attrs synced) · **journey path final form:** mobile straight rail RESTORED (user tried the v0.0.6 serpentine on their phone, called it back), desktop serpentine kept but **overlap-proof** — the line runs straight alongside each frame at the checkpoint's x and does all its swinging in the vertical gaps between images (0 of 600 sampled points inside any frame). Standing rules: no hyphens/dashes in visible copy · dropdown nav · phone timeline = straight rail · feel checks on real hardware are the user's.
- **Version:** **0.0.7** (`version.json` + all three static badge fallbacks in sync per §1.4).
- **Blockers (all user-owed):** **8 sponsor discounts** (§13.2 — sushi-bell 15%? · craves-burger 10%? · fattouh 20%? · munchease-diner 20%? · joy-of-beirut 10%? · dunkin ? · dentspa-dr-rabah ? · the-kalm-studio ? — each is a one-field edit in `sponsors.js`, badge appears automatically) · Dunkin' popup redemption details · Become-a-Sponsor Google Form URL (§6.6 — CTA runs on interim mailto until then). Resolved this round: §13.1 texts · Kalm Studio (ships, fitness, @thekalmstudio verified) · Design Lab (stays excluded per prior lock) · craves-burger/padel-square handles verified.
- **Progress log:** §15 — appended at every phase completion or notable milestone.

---

## 1. Rules of engagement (hard rules, no exceptions)

1. **Phase gate.** Never begin a phase without the user explicitly saying so ("Start Phase N"). Finishing a phase's checklist authorizes nothing; the next phase stays locked until the user unlocks it. One phase active at a time.
2. **Git gate.** Never run `git commit`, `git push`, or anything that mutates the remote unless the user explicitly says commit or push in that session. "Looks good" is not authorization. All work stays local until then.
3. **Push = deploy.** Every push to `main` auto-deploys to GitHub Pages via Actions. Treat push authorization as deploy authorization and say so before pushing.
4. **Version contract.** Bump `version.json` by +0.0.1 as part of each authorized push (the very first push ships 0.0.1 as-is). Base-10 carry: 0.0.9 → 0.1.0, 0.9.9 → 1.0.0. Commit message: `v0.1.3: short description`. Footer badge must always equal `version.json`.
5. **No invented data.** Discounts, Instagram links, story text, and redemption steps are never guessed. Unknown means blocked; blocked items get listed, not filled with plausible garbage. Nothing marked "?" ever ships.
6. **Maintenance exception.** Bug fixes to already-completed phases are allowed any time without unlocking anything. New features stay phase-gated.
7. **The gate binds the AI, not the user.** If the user explicitly asks for something outside the current phase, that request is its own authorization for that item. The rules exist to stop AI initiative, not user freedom.
8. **Session protocol.** Every session: read this file, state current phase and blockers in one or two lines, then await instruction. Update §0 STATUS as part of the work, and append a §15 Progress log entry whenever a phase completes or a notable milestone ships.

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Stack | Vanilla JS + Vite |
| Animation | GSAP + ScrollTrigger, Lenis smooth scroll, Matter.js physics |
| Hero card | CSS 3D tilt + shine (pointer on desktop, gyro/idle float on mobile) |
| Sponsor tap | Hybrid: popup only for sponsors with redemption details, direct Instagram link for the rest |
| Site shape | Single scrollable page + `account.html` placeholder + `404.html` |
| Credits | All "Brought to you by Design Lab" credits removed |
| Old repo contents | Wiped in Phase 1, deletion reaches GitHub on the first authorized push |

## 3. Page map

**index.html**, in scroll order:

1. Preloader (real asset loading, then reveal)
2. Navbar (wordmark left, Account + hamburger right)
3. Hero (copy + CTAs left, 3D membership card right)
4. The Perk Field (zero-gravity physics sponsor section, 5 category zones, left ruler)
5. Our Journey (serpentine scroll timeline: Story, Mission, Vision, Join)
6. Become a Sponsor (CTA to Google Form)
7. Footer (links, socials, version badge)

**account.html**: elegant placeholder ("Member accounts are coming soon"), same nav/footer, isolated so a future auth system slots in without touching index.
**404.html**: on-brand, one line of personality, button home. GitHub Pages serves it automatically.

Hamburger contents: Home, Sponsors, Our Journey, Become a Sponsor, Account. Sections are anchors, never standalone buttons outside the menu. Account also sits visibly in the top bar.

## 4. Repo structure

```
bssaub-website/
├── index.html
├── account.html
├── 404.html
├── public/
│   └── assets/
│       ├── brand/            logo.svg, favicon set, og-image.jpg
│       ├── card/             card-front.webp (card-back.webp optional)
│       ├── sponsors/
│       │   ├── restaurants/  <id>.webp
│       │   ├── clothing/
│       │   ├── health-beauty/
│       │   ├── fitness/
│       │   └── services/
│       └── journey/          imagery for Story/Mission/Vision if any
├── src/
│   ├── main.js               entry, orchestrates module init order
│   ├── data/sponsors.js      single source of truth for every sponsor
│   ├── modules/
│   │   ├── preloader.js
│   │   ├── scroll.js         Lenis + ScrollTrigger wiring
│   │   ├── nav.js            hamburger overlay, scroll behavior
│   │   ├── heroCard.js       CSS 3D tilt + glare
│   │   ├── perkField.js      Matter.js world, zones, forces
│   │   ├── categoryRuler.js  left-edge scroll ruler
│   │   ├── sponsorModal.js   detail popup (focus trap, ESC)
│   │   ├── journey.js        serpentine SVG timeline
│   │   └── footerVersion.js  reads version.json
│   └── styles/               tokens.css, base.css, per-section css
├── version.json
├── vite.config.js            base: '/bssaub-website/', multi-page inputs
├── .github/workflows/static.yml
└── CLAUDE.md                 this file: plan, contract, progress log
```

Asset naming: sponsor image filename equals the sponsor `id` in `sponsors.js` (`baguette-bistro.webp` ↔ `id: 'baguette-bistro'`). Raw uploads get converted and renamed during build sessions; WhatsApp screenshots and 2 MB JPEGs never ship. Bubble images serve at circle size: about 320px square webp, roughly 15 to 25 KB each.

## 5. Sponsor data model

Everything renders from one file. Adding a sponsor next semester means one object and one image.

```js
// src/data/sponsors.js
export const sponsors = [
  {
    id: 'mcdonalds',
    name: "McDonald's",
    category: 'restaurants',        // restaurants | clothing | health-beauty | fitness | services
    discount: '20% OFF',
    instagram: 'https://www.instagram.com/mcdonaldsleb',
    image: 'assets/sponsors/restaurants/mcdonalds.webp',
    size: 1.15,                      // relative bubble scale, 1 = default
    details: {                       // OPTIONAL: presence of this object = popup instead of direct link
      summary: "20% off select items across all McDonald's Lebanon stores",
      notes: 'Dine-in, Drive-Thru and Delivery. No BSS card or AUB ID needed.',
      steps: [
        "Download the McDonald's app",
        'Create an account with your AUB email',
        'Fill the activation form',
        'Account activates within 3 working days',
      ],
      links: [{ label: 'Activation form', url: 'https://forms.office.com/r/NDXGRbdcBs' }],
    },
  },
  // no details field => bubble is a plain <a> straight to Instagram
];
```

---

## 6. Section specs

### 6.1 Preloader
- Full-screen brand-colored screen, BSS wordmark, thin progress bar.
- Progress is real: `document.fonts.ready` + decode of hero card art + brand assets + all sponsor bubbles (small by design, see §8). No fake timers.
- Floor ~400ms so it never flashes, hard cap ~4s: if the network is garbage the user gets in anyway and remaining images finish quietly.
- Exit: bar completes, screen wipes upward, hero entrance fires immediately. `prefers-reduced-motion`: simple fade.

### 6.2 Navbar
- Left: "Business Student Society" wordmark in the display face. Right: "Account" link + hamburger.
- Transparent over hero, blurred glass after ~80px scroll. Hides scrolling down, returns scrolling up.
- Hamburger: full-screen overlay, links stagger in with masked reveals, big display type, active-section indicator. ESC and backdrop close it. Focus trapped while open.

### 6.3 Hero
- Two columns desktop, stacked mobile (copy first).
- Left: eyebrow ("AUB Business Student Society"), display headline, one-line subcopy, primary CTA "Get the membership card" (Microsoft form, new tab), secondary "See the perks" (smooth-scroll to the field).
- Right: the card in a perspective wrapper. Pointer drives clamped `rotateX/rotateY` (~12°), a glare layer tracks the pointer, shadow shifts opposite the tilt. Idle: slow float + sway so it never sits dead. Mobile: gyro tilt where permitted, idle loop otherwise.
- Entrance: one orchestrated timeline, card rises into its tilt while headline lines mask-reveal.

Headline options (pick one or bend one):
1. "One card. A campus of perks."
2. "Your student ID's better-dressed cousin."
3. "Join the society. Keep the change."

### 6.4 The Perk Field (signature section)
The one place this site spends its boldness. Everything else stays quiet so this section owns the memory.

**Layout.** Tall section of 5 stacked category zones (Restaurants, Clothing, Health & Beauty, Fitness, Services). Each zone pre-computes organic home positions: packed circles with jitter, responsive to width, bigger discounts get slightly larger bubbles via `size`.

**Physics (Matter.js).**
- Gravity zero. Each bubble is a circle body with rotation locked (infinite inertia): position moves, rotation never.
- Home spring: per-frame attraction toward the home point, low stiffness + air damping, so displaced bubbles glide back alive instead of snapping.
- Repulsion: physical collisions (restitution ~0.2) plus a soft radial push on personal-space overlap. Marbles, jelly.
- Scroll impulse: Lenis velocity converts to per-body impulses with random per-body bias, so a hard scroll shoves the field organically. A displacement clamp (max radius from home, extra pull beyond it) enforces "mixed, but not too much."
- Pointer acts as a gentle repulsor on desktop; bubbles shy away and drift back.
- Zones may bleed slightly at boundaries; fine, the ruler tracks scroll position, not bubble positions.

**Rendering: DOM, not canvas.** Bubbles are real `<a>`/`<button>` elements (logo + oblique discount badge pinned top-left, rotated ~ -12° in accent). Matter runs headless; each frame writes `transform: translate3d()` per bubble. GPU-composited, retina-crisp, and real links: keyboard focusable, right-clickable, `aria-label` like "Baguette Bistro, 20 percent off, opens Instagram". Canvas would throw accessibility in the trash.

**Performance rules.** IntersectionObserver activates only near-viewport zones, far bodies sleep. Fixed-timestep update with accumulator, full pause when tab hidden or section offscreen. Mobile: reduced impulse magnitude, fewer active bodies, tighter clamps. `prefers-reduced-motion`: physics off, clean static cluster grid per category, same badges and links.

**Category ruler — REMOVED (2026-07-23, user call).** The sticky left rail (line, tick labels, marker) and the mobile floating chip are gone; `categoryRuler.js` deleted. The per-zone headings (`.perk-zone__title`) are the only category labels now. Mobile keeps the thin edge rail line for anchoring. Bubbles without a verified discount render badge-less (no % anywhere, incl. aria-label) until §13.2 data lands.

**Popups.** Bubbles with `details` open the sponsor modal (scale+fade, focus trap, ESC/backdrop close, scroll locked). All others link straight to Instagram in a new tab.

### 6.5 Our Journey (serpentine timeline)
- One SVG path snaking down the section: S-curves desktop, gentler curve mobile.
- Path draws via stroke-dashoffset scrubbed to scroll; a **glowing orb** rides the draw front (mini-card marker retired 2026-07-23 — user: "a card moving as the roadmap is lame"), trailing a blurred glow stroke. The orb is "you are here"; it pops in only while the section is on screen.
- Nodes: **Our Story**, **Our Mission**, **Our Vision**, and a final **Join us** node where the path ends at a "Get the membership card" CTA (magnetic on desktop, soft breathing glow once revealed).
- Nodes ignite as the path reaches them (double-ring burst + media frame glow) — but ignition drives *decorative* state only. **Content reveals are per-node, once-only ScrollTriggers (`is-in`), fully decoupled from `is-lit`** — the 2026-07-23 fix for cards vanishing mid-viewport when the draw front lagged or receded.
- Per node: photo and text sit on **opposite sides of the path** (52%/34% grid, alternating; path weaves 59%/41%); media clip-wipes in from its side with a Ken Burns settle + slow scroll parallax; text staggers in from the other side (era chip, masked title line, paragraphs). Ambient ember particles float in the section (paused offscreen; none in reduced motion).
- Content: real Story/Mission/Vision text shipped 2026-07-23, trimmed ~30% from the user's supplied copy on their instruction.

### 6.6 Become a Sponsor
- "Have your own business? Become a sponsor." + button to the Google Form, plus a stat row (sponsor count, top discount, 5 categories) computed from `sponsors.js` so it never goes stale.

### 6.7 Footer
- Wordmark, anchors, Instagram + email icons, mini "Get the card" CTA.
- Bottom bar: © Business Student Society, AUB · version badge from `version.json`. Zero Design Lab credits.

### 6.8 account.html
- Shared nav/footer, centered: "Member accounts are coming soon", card art, CTA to the membership form. Own Vite entry so future login is an isolated add.

### 6.9 404.html
- "404. This page took a 100% discount." Button home. Same tokens, tiny page weight.

---

## 7. Design system

### Color
Palette comes from the current site. Exact hexes pending (builder markup strips CSS; confirmed from user hexes or extracted from uploaded assets). Tokens defined now so the site recolors from one file:

```css
:root {
  --bg;        /* deep base, the site's dark elegant ground */
  --surface;   /* raised panels, modal, nav glass */
  --ink;       /* primary text */
  --ink-soft;  /* secondary text */
  --accent;    /* badges, ruler marker, CTAs */
  --accent-2;  /* glare, node ignitions */
}
```

### Typography (elegant, deliberately not the current site's font)
- **A (recommended): Fraunces + Instrument Sans.** Fraunces at heavy optical sizes has warmth and slightly wonky elegance on a dark palette; Instrument Sans stays invisible for UI/body.
- **B: Cormorant Garamond + Outfit.** Sharper, high-fashion, riskier small, gorgeous large.

Fluid `clamp()` scale, tight-tracked display, small-caps wide-tracked eyebrows, 16 to 18px body. Type is part of the identity, not a delivery vehicle.

### Motion language
- power2/power3-out reveals; elastic feel lives only inside the Perk Field springs.
- Masked text reveals 0.6 to 0.9s with small stagger. Scrub only where scroll IS the mechanic (field, journey path).
- One orchestrated moment: preloader exit into hero entrance. Everything else quiet so the field stays the signature.
- Global `prefers-reduced-motion` strips scroll effects, physics, and tilt.

## 8. Performance budget
- LCP under 2.5s on throttled 4G, CLS ~0 (all media has reserved dimensions).
- JS gz ceiling 100KB: GSAP core + ScrollTrigger ~35, Matter ~25, Lenis ~3, app ~15.
- Bubbles ≤ 25KB webp, card art ≤ 120KB. Initial payload ceiling ~1.2MB with all bubbles preloaded (the price of "everything loads before entry", affordable at these sizes).
- Two font families, subset woff2, `font-display: swap`, preloaded. Zero third-party scripts.

## 9. Accessibility floor
- Semantic landmarks, skip link, visible focus everywhere.
- Hamburger and modal: focus trap, ESC, aria-expanded/aria-modal, scroll lock.
- Every bubble labeled with name + discount + destination. Ruler decorative (`aria-hidden`), categories exist as real headings.
- Contrast verified against final palette.

## 10. SEO / meta
- Real titles and descriptions per page (the current site ships `<title>Home</title>`, embarrassing).
- OG/Twitter cards using card art, favicons + manifest, canonical to the Pages URL now, domain later.

## 11. Deployment
- `vite.config.js`: `base: '/bssaub-website/'`, inputs for index, account, 404.
- `.github/workflows/static.yml`: push to `main` → checkout → setup-node → `npm ci` → `vite build` → upload-pages-artifact (dist) → deploy-pages. Pages source: GitHub Actions.
- Remember rule §1.3: push means deploy.
- Domain later: `CNAME` in `public/`, flip `base` to `/`. One line by design.

---

## 12. The 5 phases

Every phase is locked until the user says "Start Phase N" (rule §1.1). Nothing commits or pushes without explicit instruction (rule §1.2). A phase is done when its exit criteria pass and the user signs off. Phases are scopes, not sessions: Phase 3 will likely take several sessions, that's expected.

### Phase 1: Clean slate + foundation
**First action:** clone the repo, delete everything except `.git`, scaffold fresh per §4. The old files' deletion reaches GitHub on the first authorized push.
**Scope:** Vite multi-page setup, deps installed, `tokens.css` (placeholder hexes until palette lands), fonts wired, Lenis + ScrollTrigger base, navbar with working hamburger overlay, footer with version badge reading `version.json`, `sponsors.js` seeded with verified entries only, `static.yml` written, README stub.
**Blocked without:** nothing hard. Font pairing defaults to option A and palette to placeholders unless the user says otherwise before or during the phase.
**Exit criteria:** runs locally at all breakpoints, hamburger and smooth scroll feel right, footer badge shows 0.0.1, structure matches §4, pipeline verifies green on the first authorized push.

### Phase 2: Hero + preloader
**Scope:** hero layout and copy (user-picked headline), CTAs, CSS 3D card with glare/idle/gyro, honest preloader wired to real assets, orchestrated entrance timeline.
**Blocked without:** card art, headline pick.
**Exit criteria:** hero clean at every breakpoint, card tilt at 60fps with no layout thrash, preloader tracks real loading with the 4s cap, reduced-motion path verified.

### Phase 3: The Perk Field
**Scope:** the entire signature section: zone layout algorithm, Matter world, home springs, repulsion, scroll impulses, displacement clamps, DOM renderer, pointer repulsor, category ruler, sponsor modal, direct-link bubbles, mobile tuning, reduced-motion static grid.
**Blocked without:** corrected sponsor list (names, discounts, IG links), sponsor images, Design Lab decision, Dunkin's redemption details.
**Exit criteria:** 60fps on desktop, no jank on a midrange Android, "mixed but not too much" clamp feels right to the user, every bubble keyboard-accessible, modal traps focus, zero "?" data shipping.

### Phase 4: Our Journey + Become a Sponsor
**Scope:** serpentine SVG path with scrub draw, riding marker, node ignitions, Story/Mission/Vision/Join content, alternating cards, mobile variant, sponsor CTA section with computed stat row.
**Blocked without:** the actual Story/Mission/Vision text. Not negotiable, no lorem ipsum ships.
**Exit criteria:** path and marker perfectly synced to scroll both directions, nodes ignite at the right moments, mobile variant reads clean, real content in.

### Phase 5: Pages, SEO, hardening
**Scope:** `account.html`, `404.html`, full meta/OG/favicons/canonical, Lighthouse pass against §8 budgets, accessibility audit against §9, cross-device QA (a cheap Android is the benchmark, not an iPhone 15), final polish. Ends at a v1.0.0 candidate.
**Blocked without:** nothing new.
**Exit criteria:** budgets met, audits pass, user signs off the whole site on their own devices.

---

## 13. Open items owed by the user
1. ~~**Our Story / Our Mission / Our Vision text.**~~ **RESOLVED 2026-07-23** — user supplied all three; shipped trimmed ~30% (story −27%, mission −32%, vision verbatim) per their instruction.
2. **Corrected sponsor list — discounts only now.** All 25 sponsors are in the field; 8 ship badge-less until their % is confirmed: sushi-bell (15%?) · craves-burger (10%?) · fattouh (20%?) · munchease-diner (20%?) · joy-of-beirut (10%?) · dunkin (?) · dentspa-dr-rabah (?) · the-kalm-studio (?). Dunkin' popup redemption details still owed. IG handles all verified (see §14 note).
3. ~~**Design Lab call:**~~ **RESOLVED** — excluded entirely (prior session lock; no image in assets either).
4. **Palette hexes**, or upload assets for extraction. Soft-blocks final look, placeholders carry until then.
5. **Membership card art**, front minimum, decent resolution. Blocks Phase 2.
6. **Assets folder** per §4 naming (or dump raw, cleanup happens in-session).
7. **Hero headline pick** (§6.3) and **font pairing pick** (§7).
8. Confirm or veto the 4th "Join us" timeline node.

## 14. Appendix: sponsor inventory scraped from bssaub.com (verify before shipping)
Discounts marked **?** could not be mapped reliably from the old site's markup. Old-site bugs not to copy: the Craves image links to two different accounts (@cravesburger and @craveslb), Padel Square's image links to @thekalmstudio in one place and @padelsquare.lb in another, one clothing bubble has no link at all, Optique's LEARN MORE points nowhere.

| Category | Sponsor | Discount | Instagram |
|---|---|---|---|
| Restaurants | Baguette Bistro | 20% | @baguettebistrolb |
| Restaurants | Kibbe Kitchen | 10% | @kibbekitchen |
| Restaurants | McDonald's | 20% select items (popup) | @mcdonaldsleb |
| Restaurants | Sushi Bell | 15%? | @sushi_bell |
| Restaurants | Craves Burger | 10%? | @cravesburger or @craveslb? |
| Restaurants | Fattouh | 20%? | @fattouhrestaurant |
| Restaurants | Salon Beyrouth | 15% | @salonbeyrouth |
| Restaurants | Munchease Diner | 20%? | @muncheasediner |
| Restaurants | Joy of Beirut | 10%? | @joyofbeirut |
| Restaurants | Allo Beirut | 10% | @allobeirut.lb |
| Restaurants | Cravy | 10% | @cravylb |
| Restaurants | Dunkin' | ? (popup) | @dunkinleb |
| Restaurants | Smash It | 15% | @smash.it.1 |
| Restaurants | Papa's Mia Tacos | 30% | @papasmiatacos |
| Clothing | Pop Jammies | 10% | @popjammies |
| Clothing | Leaders Fit | 25% | @leaders.fit |
| Clothing | Belinda Atelier | 15% | @belinda.atelier |
| Health & Beauty | Pure 28 Clinic | 15% | @pure28clinic |
| Health & Beauty | Pure 28 Beauty | 15% | @pure28beauty |
| Health & Beauty | DentSpa Dr. Rabah | ? | @dentspa_drrabah |
| Health & Beauty | Optique et Vision | 25% | @optiqueetvision |
| Fitness | Padel Loft | 25% | @padel.loft |
| Fitness | Padel Square | 20% | @padelsquare.lb (verify) |
| Services | Simple A Tutoring | 20% | @simplea_tutoring |
| Services | Design Lab | 20% (pending §13.3) | @designlab.leb |

**Key links carried over:** membership form `https://forms.cloud.microsoft/r/d5fFFxbKKN` · sponsor form (Google Forms) · McDonald's activation `https://forms.office.com/r/NDXGRbdcBs` · IG `@businessstudentsociety` · `aubbusinesssociety@gmail.com`

**2026-07-23 verification note (old site down, per the user — resolved by web search):** Craves Burger → **@cravesburger** (Mar Mikhael; @craveslb doesn't surface) · Padel Square → **@padelsquare.lb** (real account, Saida) · The Kalm Studio → **@thekalmstudio**, a Pilates studio in Beirut ⇒ ships under **fitness**. Design Lab excluded. All 25 others ship; the eight §13.2 discounts stay off-site until confirmed.

---

## 15. Progress log (append-only)

One entry per phase completion or notable milestone, newest first, written in the same session the work finishes. Entries ride along with the next authorized commit — the git gate (§1.2) is unchanged: commits and pushes happen only on explicit user instruction.

Format: `YYYY-MM-DD · version · what happened`

- **2026-07-23 · 0.0.7 pushed ·** **New card art + journey course correction** (user: "I updated membership_card.png, use it correctly" then, interrupting the verify, "return the straight timeline phone, and on desktop make sure the line isnt overlapping any image and its good swirly … push" — one push covers both). **Card:** new 663×473 source (line-art campus design, alpha corners) re-converted via the P2 sharp pipeline → `card-front.webp` 61.1 KB (budget 120) at q90; `og-image.jpg` recomposed from the new art on the brand ground (640 px card centered on 1200×630 `#290a13`, 73 KB); width/height attrs 663×478→663×473 on index + account (CLS guard). **Journey:** the v0.0.6 mobile serpentine lasted one version — the straight rail returned exactly as P4 built it (rail CSS block + 18px `--dot-x` default restored; JS clears inline dot styles on mobile so CSS owns the rail; verified dots all at x=38, path x-sweep 0.0 px). Desktop keeps the beside-the-image checkpoints but the path builder now emits **waypoints**: it enters each frame's column 24 px above the image at the dot's x, runs STRAIGHT alongside the full frame (through the checkpoint), exits 24 px below, and does the entire S-swing in the vertical gap before the next frame — the v0.0.6 single-curve-per-node geometry was clipping image corners (e.g. the top-center start descending at 50% through the first image's 0–52% span). Ignition bookkeeping generalized (`dotIdx` → prefix lengths), verified by binary-searching each node's first-lit progress: the path point at every ignition length sits ≤2 px from its dot; unlit at p=0, all lit at p=1. **Overlap proof: 0 of 600 sampled path points inside any frame rect inflated +6 px** (stroke + glow bleed); sweep 95 px so it stays swirly. Zero console errors; build **91.8 KB JS gz of 100**. v0.0.7 synced (version.json + 3 badges).
- **2026-07-23 · 0.0.6 pushed ·** **Journey checkpoints beside the images + mobile serpentine + no-scroll popup** (user: "checkpoints beside the image, weird offset … on mobile make it not a straight line, like desktop … the popup shouldn't scroll, all details in one popup on all devices … push"). **Journey:** dot positioning moved from CSS fractions (--dot-x 59/41%, mobile rail x=18px top=26px) into `buildPath()` — each content node's dot is placed in measured px against its media frame (desktop: 28 px beside the image's path-side edge; mobile: 12 px inside the image edge, alternating left/right), always vertically centered on the frame; the Join dot stays CSS-owned (50%, above the CTA). Because the path is generated FROM the dots, the fix propagates: **mobile now serpentines exactly like desktop** (straight rail + 46 px left padding + all-lit-from-right wipes deleted; mobile media wipes now alternate sides via the inherited desktop rules; mobile Join recentered). Path start unified to top center (the W<700 rail special case died with the rail). Inline-px staleness (the P4 --dot-x lesson) is avoided because positions recompute inside every buildPath call (init, resize, fonts.ready). **Modal no-scroll guarantee:** base panel cap now `calc(100dvh − 2·gutter)`; compact tier at ≤49rem tall (784 px — chosen so the full 677 px layout can never meet a cap it doesn't fit: >784 px windows always have ≥688 px available; covers 1366×768 laptops), micro tier at ≤36rem for the old-SE class, and a **two-column landscape layout** (≤30rem tall + ≥40rem wide: header column left, steps column right, CTA + IG across the bottom — 297 px total). `overflow:auto` stays as an invisible failsafe only. Latent bug fixed en route: `[hidden]` fields (notes/steps/links on future popups) were being shown by the class-level `display:grid` — `[hidden] { display:none !important }` guard added. **Verified headless:** desktop dots 28 px off the image edge / 0 px vertical error / path through all dots ≤2 px; mobile (390×844 after reload — the pane fires no resize event, noted) dots 12 px inside alternating edges, 0 px vertical error, path sweeps 84% of track width; reduced path identical geometry, fully drawn, all lit; **no-scroll matrix all green: 1280×800 (677 px full) · 1366×768 (542 compact) · 390×844 (635) · 360×640 (529) · 320×568 (520 micro) · 844×390 (297 two-column)**; zero console errors. **Build: 91.7 KB JS gz of 100.** v0.0.6 synced (version.json + 3 badges).
- **2026-07-23 · 0.0.5 pushed ·** **Quality round: modal redesign · dropdown nav · background v2 · story compaction · no-hyphen copy rule** (user batch: "improve the pop up menu … compact Our Story more … never use a hyphen, update the whole site … hamburger should open under the hamburger, not a whole panel … improve the quality of the website and especially the background … push after u finish everything"; §1.7 authorization throughout). **Modal (`modal.css` rewrite + `sponsorModal.js` touches):** centered header — 88 px logo with wine double-ring glow, discount as an oblique accent pill (rotate −4°, echoing the field badges), Fraunces name, balanced summary; steps became numbered chips (CSS counter in accent circles) over a hairline divider; links row full-width primary + IG restyled as a ghost pill; panel gets a wine radial header gradient, 24 px radius, deep shadow, thin rose scrollbar, overscroll containment; entrance now back.out(1.3) pop; `discount: null` popups hide the pill (future Dunkin hardening). **Nav (user call — overlay retired):** hamburger now opens a compact glass dropdown anchored under the button (fixed, top right, 300 px, tabular indexes, active-section dot); closes on ESC (focus returns), outside press, scroll movement > 12 px, link click, or tabbing out (focusout); scroll lock and Lenis stop removed — a dropdown must not freeze the page; full-screen overlay markup/CSS deleted from both pages. **Background v2 (the "especially the background" fix):** ambient canvas now layers 3/2 (d/m) aurora wine blobs — huge soft radial gradients orbiting on 1–3 min periods, drawn at 1/8 resolution and upsampled (~98% fill-cost cut) — under boosted dust (60/30, alpha up to 0.2, 35% rose) and 5/3 shimmer streaks; plus static CSS: three viewport-sized ground washes on `html` (wine light from above, ember corner, deep vignette; `background-size: 100vw 100vh` so iOS's missing fixed-attachment degrades cleanly) and an SVG-turbulence film grain on `body::after` at 0.05 — so reduced motion (canvas never created) still gets a designed ground, not flat maroon. Page scrollbar restyled on-brand; primary buttons gained a hover glow. **Copy:** Our Story compacted to 2 paragraphs / 62 words (from 83; all phrases the user's own); **standing rule adopted: no hyphens or dashes anywhere in user-visible text** — em dashes → commas/colons/periods, titles "BSS — AUB…" → "BSS · AUB…", compounds rephrased ("student-led hub" → "hub led by students", "real-world skills" → "skills for the real world", "career-ready" → "ready for their careers", "Dine-in, Drive-Thru" → "Dine in, drive thru", alt texts cleaned); enforced by a DOM sweep over every text node + aria-label + alt + title/meta → **zero hits**. **Verified headless:** modal open/pill/chips/gradient/IG-pill + null-discount pill hidden; dropdown opens under the bar right-aligned (291 px), focus to first link, ESC closes + returns focus, outside press closes, scroll closes, no scroll lock; ambient 94.3% of pixels lit (was ~0.7%) at ≤20% peak alpha, washes ×3 + grain live; reduced path: no canvas, washes/grain still present, menu opens AND closes instantly, preloader releases on timers, no overflow 375/1280, zero console errors. (Pane artifact re-confirmed: in normal mode the preloader's gsap curtain never completes headless, so `u-scroll-lock` lingers — release verified via the reduced path's timer route; not a runtime bug.) **Build: 91.6 KB JS gz of 100** (+0.4 — the dropdown is leaner than the overlay it replaced). v0.0.5 synced (version.json + 3 badges).
- **2026-07-23 · 0.0.4 pushed ·** **Juice round: Perk Field alive + ambient background** (user picked from a 20-idea brainstorm: "do what u think is good, and push" — shipped the recommended set: field ideas grab/jelly/impact + near-free amplifiers, background dust + shimmer whisper; §1.7 authorization, §1.6 covers the bugfix). **Perk Field:** ① grab-and-throw — desktop grabs on pointerdown, touch grabs after a 160 ms still hold (moving >9 px first hands the gesture to native scroll; quick taps never grab and still open links/modal), grabbed body velocity-follows the pointer so collisions keep resolving (it plows through neighbors), release flings with velocity from the last ~110 ms of samples (cap 30 d / 20 m + decaying cap-boost so throws sail past the normal speed cap), post-drag click suppressed (capture phase, 420 ms) so a throw never triggers the link, touch grab blocks scroll via non-passive touchmove + `navigator.vibrate(8)` where it exists ② jelly — velocity-aligned squash-stretch (rotate·scale·unrotate, ≤8.5%, smoothed magnitude + direction) composed with ±0.8% phase-offset idle breathing ③ impact flashes — `collisionStart` above rel-speed 2.4 → rim-ring animation on both bubbles + pooled spark at the radius-weighted contact point; 90 ms global + 260 ms per-bubble cooldowns stop strobing under scroll shoves ④ stir currents — smoothed pointer velocity adds a directional term to the repulsor (swiping stirs the field like water) ⑤ hover make-room — neighbors part around the hovered bubble, badge tick-tocks ⑥ random shiver impulse every 2.2–4.6 s of sim time. **Bugfix found en route:** the pointer repulsor compared section-relative pointer X to canvas-local body X — its center sat ~81 px right of the cursor at 1280 (grows with viewport); fixed with per-zone `offsetX` mapping. **Ambient (`ambient.js` + css):** one fixed z-index −1 canvas — 48/26 (d/m) dust motes (30% accent-rose, depth-scaled, twinkling, slow rise) that inherit Lenis velocity (−0.055·depth: scrolling streams them past the viewport — the field's scroll-physics echoed site-wide at whisper intensity, §7 respected) + 4/3 sea-shimmer streaks (moonlight-on-water crossings ≈1 min, breathing alpha ≤0.045 — campus above the Mediterranean). DPR ≤1.5, paused when hidden, never created under reduced motion. **Verified headless** (dev pane, deterministic stepping): grab engage/follow-to-11.7 px/fling-at-cap-30/clean release, drag-click swallowed (modal stayed shut) while plain tap opens it, touch hold-grab + move-cancel + quick-tap-through, jelly composes then decays to breathe-only at rest, both collision partners flash + spark lands 3 px off contact, hover parts 2 in-range neighbors, stir sign-correct, shiver kicks, dust 48/48 streams up under injected velocity + 6.5k lit pixels, streaks cross both directions, reduced path inert end-to-end, no overflow 375/1280, zero console errors. QA-harness lessons (runtime unaffected): writing `body.position` directly desyncs Matter's vertices (broadphase never sees the move), and velocity injection must mirror `body.velocity` AND `positionPrev` — `Body.setVelocity` keeps them coherent in real use. **Build: 91.2 KB JS gz of 100** (+3.5). v0.0.4 synced (version.json + 3 badges).
- **2026-07-23 · 0.0.3 pushed ·** **§13.1 text landed + journey overhaul + full 25-sponsor field + ruler removed** (user message supplied Story/Mission/Vision with "compact ~30% of story/mission", "glowing circle not the card", "images disappear mid-screen — fix", "5 things, juice", "remove the left category list, keep the names beside the bubbles", "add all sponsors, don't open bssaub.com (down)", and push authorization in-message). **Disappearing-card bug root-caused:** card opacity was keyed to the *reversible* `is-lit` class, which follows the path draw front — the front lags the viewport (scrub start 62%) and recedes on upward scroll, so a mid-screen card could sit invisible or vanish. Fix: content reveals moved to per-node `once: true` ScrollTriggers (`is-in`, start 'top 78%'); `is-lit` now drives only dot bursts + frame glow. Verified headless: `is-in` fires with the path still at zero draw; reverse scroll un-lights all dots while every `is-in` persists; CSS end-states proven via transition-cancel probes (the pane's frozen rendering clock stalls CSS transitions — documented artifact, not a bug). **Journey rebuild:** media/text on opposite sides (52/34 alternating grid, path weaving 59/41 between them), five juice adds — ① glowing orb marker (pulsing halo, pops in with the section) + blurred glow-trail stroke behind the draw front ② double-ring ignition bursts + lit-frame glow ③ clip-wipe photo reveals with Ken Burns settle (1.24→1.12) + scroll parallax inside the crop margin ④ era chips ("Since 1965" / "What drives us" / "Where we're headed" / "Your move") + masked title lines + delay-staggered opposite-side paragraphs ⑤ ambient ember particles (14 desktop / 8 mobile, paused offscreen, none reduced) + magnetic breathing Join CTA. Text trims: story −27% (83 w), mission −32% (52 w), vision verbatim — all sentences derived from the user's copy, nothing invented. **Sponsors:** 25 of 26 ship — Design Lab stays excluded (prior lock). 9 new bubbles converted (1.8–22.4 KB, ≤ 25 KB budget; sources are 375 px old-site scrapes, native quality). Handles verified by web search since the old site is down: craves-burger→@cravesburger, padel-square→@padelsquare.lb, the-kalm-studio→@thekalmstudio (Pilates, Beirut ⇒ fitness). 8 ship badge-less (`discount: null` → no badge, no % in aria-label) pending §13.2; Padel Square ships its never-questioned 20%. **Ruler:** `categoryRuler.js` deleted, rail + chip markup/CSS gone, zone headings carry the categories, field spans full width. Journey photos re-encoded 1012–1400 px q84 (36/133/232 KB, lazy — LCP untouched). Verified: 25 bubbles (17 badged), orb rides the draw front at 0.0 px error, glow/draw dashoffsets in lockstep, mobile rail path starts `M 38 0` exactly on the dots, reduced path (all lit + revealed, marker hidden, 0 particles, preloader resolves on timers), zero console errors, no overflow at 375/1280, build 87.7 KB JS gz vs 100 KB. v0.0.3 synced (`version.json` + 3 badges).
- **2026-07-23 · 0.0.2 pushed ·** **Production measurement + v0.0.2 ship** (user: "open the actual website and take it, then update and push"). Live-deploy sanity on v0.0.1 first: HTTP/2 confirmed (`nextHopProtocol: h2`), zero console errors, all assets 200, 16 bubbles, badge correct. **Lighthouse ×3 against the live URL (mobile, throttled): LCP 1819/2291/2468 ms → median 2.29 s — §8's 2.5 s budget MET in production** · Perf 92–97 · A11y 100 · Best Practices 100 · SEO 100 · CLS ~0. The local ~3.3 s that drove the "design tension" analysis was an HTTP/1.1 `vite preview` artifact (no multiplexing/priorities); the H2 + Pages CDN reality is a second faster. **The §6.1 curtain stays exactly as designed — no WONK drop, no trims needed.** Shipped as v0.0.2: exact palette (`--accent #881532` extracted from logo + regenerated favicons/og-image/preloader ground), account-only font preloads (visible swap fix where there's no curtain), entrance offset 0.22→0.14 s, version bump with all three static badge fallbacks synced to `version.json` (§1.4). Post-deploy re-measure of **live v0.0.2** (commit `dd814d9`, deploy green in 26 s): **LCP 1663/1910/1981 ms → median 1.91 s · Perf 94–96 · A11y/BP/SEO 100 · CLS 0.048.** Every §8 budget passes in production with margin.
- **2026-07-22 · 0.0.2 local, unpushed ·** **Maintenance round: exact palette + LCP investigation** (user: "continue building"; all remaining feature work is content-blocked, so this closed the two open non-content items; maintenance exception §1.6). **Palette (§13.4 closed):** brand maroon extracted programmatically from `assets/logo.png` — 5,151-pixel sample → `--accent: #881532` (eyeballed `#8e1e3f` was ~ΔRGB(6,9,13) too pink; `--accent-2 #e18ba1` turned out already exactly on-hue at 344.6° and stays). Propagated: `--accent-strong #a31a3c`, journey-marker deep stop `#4d0c1d`, preloader/og ground `#290a13`; favicons + og-image regenerated with the true ink; white-on-accent contrast improves 8.72→9.55. **LCP, corrected analysis (supersedes the P5 entry's lever list):** the LCP paint clock starts at the hero card's first *nonzero-opacity* frame — occlusion by the opaque curtain does NOT defer it (so "trim the wipe" was a dud lever); the driver is the 4G asset pipeline ahead of curtain release plus the entrance offset. Experiments (local Lighthouse, prod build): preloading bubbles+fonts → CLS 0 but LCP +0.4s (HTTP/1.1 contention with the JS the release depends on — note vite preview is H1; live Pages is H2, where this would likely behave better); fonts-only → same direction. **Shipped config:** font preloads on `account.html` only (no curtain there → swap-shift is user-visible → free fix), index stays fastest-reveal (card preload only), entrance card offset 0.22→0.14 s (invisible — still behind curtain). **3-run medians, index:** LCP 3.26 s · Perf 89–90 · CLS 0.049 (the shift is behind the opaque curtain — human-invisible, within §8's "~0"). **Budget verdict: 2.5 s LCP remains structurally unmet under the §6.1 curtain on throttled 4G.** Remaining levers cost design and are the user's call: drop Fraunces' SOFT/WONK axes file (~60 KB, loses §7 wonk) or accept ~3.3 s; production truth should come from PageSpeed Insights against the live URL. Verified: new tokens live (buttons compute rgb(136,21,50)), preloads present in dist (index: card only; account: 2 latin fonts), zero console errors, 16 bubbles intact. **No commit, no push — git gate §1.2; ships as v0.0.2 on the user's word.**
- **2026-07-22 · 0.0.1 live ·** **First push, shipped.** User authorized commit + push ("ok push"). Before staging: discovered the raw `assets/` folder (30 files, 6.9 MB — original sponsor PNGs, logo, card, and the three journey photos including identifiable real students at a gala) was already committed and already on `origin/main` from the pre-session "Initial BSS website" commit — confirmed via `git fetch` + `rev-parse` (local HEAD == origin/main before this push). That predates this rebuild entirely; nothing in this session newly caused it. Untracked `assets/` from git going forward (`git rm -r --cached`, local files kept) to match the plan's own stated intent (§4: raw uploads never ship) and this session's `.gitignore` comment — but note this does NOT scrub it from history; it remains recoverable from commit `1a12417` on GitHub unless the user requests a history rewrite (not done — requires force-push, out of scope without explicit instruction). Commit `f130167`: 94 files changed, old vanilla-site files removed, full src/public tree added. Pushed to `origin/main`; GitHub Actions deploy (`Deploy to GitHub Pages`) confirmed triggered and running at push time. Live URL: `https://chaos-961.github.io/bssaub-website/`.
- **2026-07-22 · 0.0.1 staged ·** **Phase 5 built + audited** (Phase 4 closed by the user's "start P5" unlock). Pages: `account.html` rebuilt per §6.8 — shared nav/hamburger/footer (own `src/account.js` entry, cross-page overlay links, `aria-current` marking), card art, membership CTA; `404.html` hardened — `noindex`, absolute-path favicons (§11 note: these join the base-flip checklist), stays ~1 KB JS. SEO/meta: canonical + full OG/Twitter set on index/account, `og-image.jpg` composed from the real card art on the brand ground (77 KB), favicon set + `manifest.webmanifest` generated (maroon BSS tile). Fixes en route: nav.js overlay handler threw on `./#…` hrefs from account.html (guarded to pure-`#` anchors); modal IG link shipped href-less (uncrawlable) → real default, overwritten on every open; bubble aria-labels switched to literal discount text ("20% OFF") for WCAG 2.5.3 — deviates from §6.4's spoken-style example, reads identically; ≤360 px nav sizing so the wordmark keeps ~10 px clearance at 320 px. **Lighthouse (prod build, throttled mobile, local): Performance 90 · Accessibility 100 · Best Practices 100 · SEO 100 · CLS 0.049 · TBT 56 ms.** Contrast audit: every token pair ≥ 7.78:1 (AAA). Budgets: JS 86.8 KB gz of 100 · card 57 KB of 120 · bubbles ≤ 15.1 KB of 25 · initial payload ≈ 450 KB of 1.2 MB · 2 font families ✓ (font `<link rel=preload>` skipped — hashed filenames; the §6.1 curtain hides the swap window anyway). **One budget open: LCP 3.26 s vs 2.5 s — root-caused to design, not network:** the LCP element is the hero card, which fades in with the orchestrated entrance after the preloader curtain; LCP ≈ curtain exit + entrance by construction. Levers if the user wants 2.5 s: trim wipe/entrance (~0.3 s), drop Fraunces' SOFT/WONK axes file (~60 KB → ~0.4 s on 4G, loses §7's wonk), or accept 3.3 s as the price of the §6.1 moment. Cross-device QA on a midrange Android + full-site sign-off remain the user's (§12 P5 exit). Site is a v1.0.0 candidate pending: LCP call · §13.1 texts · sponsor data answers (§13.2/3, Kalm Studio, Dunkin', sponsor-form URL) · sign-off. No commit (git gate §1.2).
- **2026-07-22 · 0.0.1 staged ·** **Phase 4 built** (Phase 3 closed by the user's "start P4" unlock). **Key discovery:** `our_story.png` / `our_mission.png` / `our_visio.png` are *photographs* (Commerce Students' Society archive shot · members handing over a card · OSB 125-years gala), not text slides — so the actual Story/Mission/Vision copy exists nowhere in the handoff and §1.5 forbids authoring it. Journey ships structurally complete: real headings + those photos (converted to `public/assets/journey/*.webp`, 29–115 KB, lazy) + an honest "Text coming soon" line per card; **§13.1 text still owed and drops in with three one-line edits.** Built: `journey.js` — SVG path generated from measured node positions (S-curves desktop, straight rail mobile), stroke-dashoffset draw scrubbed to scroll, mini-card marker riding via native `getPointAtLength` on the same progress (MotionPathPlugin behavior without shipping it), node ignition keyed to exact per-node prefix path lengths so it can never drift, Join node ends the path at the membership CTA, font-reflow + resize rebuilds; `sponsorCta.js` — §6.6 section with stat row computed from `sponsors.js` (16 · 30% · 5 today), CTA on interim `mailto:` to the verified society email until the Google Form URL arrives (swap = one href). Fixed during verification: inline `--dot-x` styles beat the mobile media query (dots stuck at desktop positions on phones) → geometry moved fully into CSS; stale Lenis scroll limit after init-time height mutations meant the ST end was unreachable and **the Join node could never ignite** → new `scroll.refresh()` (lenis.resize + ScrollTrigger.refresh) after init and font-ready; one PowerShell text pass mojibake'd index.html's UTF-8 — repaired byte-exact, lesson recorded: Edit tool only for file content. Verified headless: 4-segment path, dasharray/offset math, scrub sync forward AND backward incl. un-ignition, marker on-path ≤1.5 px with clamped ±16° tilt, progress 1.0 + all four nodes lit at page bottom, card alternation 65/35/65/50, mobile rail (all dots x=38, path starts on rail), reduced-motion (fully drawn, all lit, marker hidden), stats fill, zero console errors, no overflow at 375/1280, build 86.2 KB JS gzip vs 100 KB budget. Left for the user: scroll-feel on real hardware, §13.1 text, sponsor-form URL. No commit (git gate §1.2).
- **2026-07-22 · 0.0.1 staged ·** **Phase 3 built** (Phase 2 closed by the user's "start P3" unlock). The Perk Field ships with the 16 verified sponsors — 16 logos converted to 320px webp bubbles (max 15.1 KB vs 25 KB budget); the 10 blocked sponsors stay listed in `sponsors.js` and join by adding one object + one image each. Built: `perkField.js` (packed-circle-with-jitter zone layout, responsive + size-weighted, 40-pass overlap relaxation; zero-gravity Matter world, rotation-locked circle bodies, restitution 0.2; home springs; soft personal-space repulsion; Lenis-velocity scroll impulses with deterministic per-body bias; displacement clamp with extra pull beyond radius; desktop pointer repulsor; fixed-timestep accumulator on gsap.ticker; IntersectionObserver zone activation + section pause + hidden-tab pause; mobile tuning knobs; all feel constants in a `TUNING` block for the live pass; reduced-motion = same packed cluster, static, engine never created), DOM renderer (real `<a>`/`<button>` bubbles, oblique −12° accent badges, spec aria-labels, translate3d writes only), `categoryRuler.js` (sticky rail, marker riding section progress, active label grows/accents; mobile edge rail + floating chip with text morph), `sponsorModal.js` (McDonald's popup: scale+fade, focus trap, ESC/backdrop, scroll lock, focus return). Preloader now tracks all 17 `[data-preload]` images per §6.1. Fixed during verification: gsap `clamp` arg order in bubble sizing; modal panel tween switched off `autoAlpha` so the synchronous focus move works. Verified headless (deterministic `stepOnce` stepping): settle ≤1 px, 323 px throw → home in ~1 s sim, pointer push 15.8 px/recovery 0.8 px, impulse path fires with per-body spread and stays bounded under an extreme velocity spike (speed cap + clamp), modal full cycle, ruler/chip wiring, mobile re-layout, reduced path, 0 overlaps at rest, 0 console errors, build 85.3 KB JS gzip vs 100 KB budget. Left for the user: 60 fps feel on real hardware, Android jank check, clamp feel ("mixed but not too much" — knobs in TUNING). No commit (git gate §1.2).
- **2026-07-22 · 0.0.1 staged ·** **Phase 2 built** (Phase 1 closed by the user's "start P2" unlock). Card art converted `assets/membership_card.png` → `public/assets/card/card-front.webp` (663×478, 57 KB vs 120 KB budget; source is 663px wide — fine at display size, a higher-res original can drop in with zero code changes). Headline locked to §6.3 option 1 "One card. A campus of perks." per the user's don't-ask directive — swap is one line in `index.html`. Built: honest preloader (tracks both font families + card art decode; floor 400 ms, hard cap 4 s; bar moves by CSS transition; reduced-motion = simple fade on timers, zero ticker dependency; inline critical CSS so the brand screen paints before the bundle; no-JS never sees it), `heroCard.js` (clamped ±12° tilt via quickTo, glare tracking pointer, shadow shifting opposite, idle float/sway loop, gyro only where it fires without a permission prompt — iOS 13+ keeps idle, pointer path only on `pointer: fine`), orchestrated entrance (masked headline lines with descender-safe clipping, card rise, staggered soft elements) fired as the preloader curtain lifts. Added `?reduced-motion` URL QA hook (scroll.js) and dev-only `window.__bss` handle; `sharp` as devDependency for asset conversion. Verified headless (manual gsap ticker stepping, since the detached pane has no rAF): full preloader→entrance choreography end states, tilt matrix + glare position/opacity + opposite shadow shift + pointerleave reset, reduced path end-to-end on timers alone, zero console errors, no horizontal overflow at 375/1280, correct card aspect, build green at 53.2 KB JS gzip (budget 100 KB). Left for the user's own eyes: 60 fps feel of tilt/entrance. No commit (git gate §1.2).
- **2026-07-22 · 0.0.1 staged ·** **Phase 1 built** (pending user sign-off). Vite 6 multi-page scaffold (index/account/404) per §4; deps installed (gsap, lenis, matter-js; Fraunces + Instrument Sans self-hosted variable woff2); `tokens.css` placeholder palette sampled from `assets/logo.png`/`membership_card.png` (maroon `#8e1e3f` family); Lenis + ScrollTrigger base with anchor gliding; navbar (glass after 80px, hide-down/show-up, full-screen hamburger with masked stagger, focus trap, ESC/backdrop close, scroll lock, active-section marker); footer with badge reading `version.json` (shows v0.0.1); `sponsors.js` seeded with 16 verified entries, 10 blocked entries listed in-file (§1.5); `static.yml`; README; `public/assets/` skeleton. Raw `assets/` folder gitignored (source material stays local). Build green — JS 51.9 KB gzip vs 100 KB budget (§8; Matter.js not imported until P3). Verified headless: landmarks, zero console errors, fonts load, no horizontal overflow at 375/1280, overlay open/ESC cycle incl. focus management, stub pages + base-path home links. Not verifiable headless: animation feel (browser pane had no rAF) — that judgment is the user's exit criterion anyway. No commit (git gate §1.2).
- **2026-07-22 · 0.0.1 staged ·** Plan adopted as CLAUDE.md (from `BSS-WEBSITE-PLAN.md`). Repo already wiped locally: the 8 old-site files are deleted but uncommitted, so Phase 1's first action is pre-done; deletion reaches GitHub on the first authorized push. Raw assets found in `assets/`: `logo.png`, `membership_card.png`, `our_story.png`, `our_mission.png`, `our_visio.png`, and 25 sponsor PNGs in `assets/Sponsored/`. **Roster note (needs user confirm before Phase 3):** those 25 PNGs = the §14 table minus Design Lab plus `thekalmstudio.png` (The Kalm Studio is not in §14); a prior session had locked "exclude Design Lab entirely". No phase active — awaiting "Start Phase 1".
