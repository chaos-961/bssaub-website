# BSS AUB Website: Build Plan & AI Operating Contract

Rebuild of bssaub.com for the AUB Business Student Society. One goal drives every decision: get an AUB student to grab the membership card. Everything else (sponsors, story, animations) exists to make that decision feel obvious.

This file is both the plan and the standing prompt. Any AI session working on this project reads this file first, obeys the rules in §1, and works only inside the currently authorized phase.

Repo: `https://github.com/chaos-961/bssaub-website.git`
Hosting: GitHub Pages via Actions (custom domain later).

---

## 0. STATUS (keep current)

- **Current phase:** Phase 5 shipped. **v0.0.1 is live** (first authorized push, 2026-07-22, commit `f130167`) — GitHub Pages Actions deploy triggered, in progress at push time. Open items unchanged: LCP 3.26s vs 2.5s budget (design tension, §15 levers), Story/Mission/Vision copy (§13.1), sponsor-data blockers (§13.2/3). Next work is maintenance-exception fixes or unblocking content — no phase is currently locked/pending since all 5 are built.
- **Version:** **0.0.1 live.** Next push bumps to 0.0.2 per the version contract (§1.4) — do not re-ship 0.0.1.
- **Blockers:** **Story/Mission/Vision text** (§13.1 — photos exist, copy does not; drops straight into the three journey cards) · corrected sponsor list incl. The Kalm Studio question (§15 notes) · Design Lab call (§13.3) · Dunkin' redemption details · Become-a-Sponsor Google Form URL (§6.6 — CTA runs on interim mailto to the verified society email until then) · palette hexes (soft, §13.4). Resolved: headline (§6.3 opt 1, AI-locked) · card art (57 KB webp) · journey imagery (3 photos converted).
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

**Category ruler.** Sticky left edge for the whole section: vertical measurement line, 5 tick labels, a marker sliding with scroll progress, active label grows and takes accent. Mobile: thin edge rail + floating category chip that morphs text on zone change.

**Popups.** Bubbles with `details` open the sponsor modal (scale+fade, focus trap, ESC/backdrop close, scroll locked). All others link straight to Instagram in a new tab.

### 6.5 Our Journey (serpentine timeline)
- One SVG path snaking down the section: S-curves desktop, gentler curve mobile.
- Path draws via stroke-dashoffset scrubbed to scroll; a glowing mini-card marker rides it (GSAP MotionPath, same scrub). The marker is "you are here."
- Nodes: **Our Story**, **Our Mission**, **Our Vision**, and a final **Join us** node where the path ends at a "Get the membership card" CTA. A journey ending at the conversion point instead of just stopping. (Vetoable, but it earns its place.)
- Nodes ignite as the path reaches them (pulse + ring), content cards slide in alternating sides on desktop, single column mobile.
- Content: blocked on the actual Story/Mission/Vision text.

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
1. **Our Story / Our Mission / Our Vision text.** Lives only inside images on the old site. Paste it or include the slides in assets. Blocks Phase 4.
2. **Corrected sponsor list:** name, category, discount, Instagram URL, which ones need popup details (Dunkin at minimum; McDonald's already captured in §5). Blocks Phase 3.
3. **Design Lab call:** credits are gone regardless; keep them as a Services sponsor (20%) or remove entirely? Blocks Phase 3.
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

---

## 15. Progress log (append-only)

One entry per phase completion or notable milestone, newest first, written in the same session the work finishes. Entries ride along with the next authorized commit — the git gate (§1.2) is unchanged: commits and pushes happen only on explicit user instruction.

Format: `YYYY-MM-DD · version · what happened`

- **2026-07-22 · 0.0.1 live ·** **First push, shipped.** User authorized commit + push ("ok push"). Before staging: discovered the raw `assets/` folder (30 files, 6.9 MB — original sponsor PNGs, logo, card, and the three journey photos including identifiable real students at a gala) was already committed and already on `origin/main` from the pre-session "Initial BSS website" commit — confirmed via `git fetch` + `rev-parse` (local HEAD == origin/main before this push). That predates this rebuild entirely; nothing in this session newly caused it. Untracked `assets/` from git going forward (`git rm -r --cached`, local files kept) to match the plan's own stated intent (§4: raw uploads never ship) and this session's `.gitignore` comment — but note this does NOT scrub it from history; it remains recoverable from commit `1a12417` on GitHub unless the user requests a history rewrite (not done — requires force-push, out of scope without explicit instruction). Commit `f130167`: 94 files changed, old vanilla-site files removed, full src/public tree added. Pushed to `origin/main`; GitHub Actions deploy (`Deploy to GitHub Pages`) confirmed triggered and running at push time. Live URL: `https://chaos-961.github.io/bssaub-website/`.
- **2026-07-22 · 0.0.1 staged ·** **Phase 5 built + audited** (Phase 4 closed by the user's "start P5" unlock). Pages: `account.html` rebuilt per §6.8 — shared nav/hamburger/footer (own `src/account.js` entry, cross-page overlay links, `aria-current` marking), card art, membership CTA; `404.html` hardened — `noindex`, absolute-path favicons (§11 note: these join the base-flip checklist), stays ~1 KB JS. SEO/meta: canonical + full OG/Twitter set on index/account, `og-image.jpg` composed from the real card art on the brand ground (77 KB), favicon set + `manifest.webmanifest` generated (maroon BSS tile). Fixes en route: nav.js overlay handler threw on `./#…` hrefs from account.html (guarded to pure-`#` anchors); modal IG link shipped href-less (uncrawlable) → real default, overwritten on every open; bubble aria-labels switched to literal discount text ("20% OFF") for WCAG 2.5.3 — deviates from §6.4's spoken-style example, reads identically; ≤360 px nav sizing so the wordmark keeps ~10 px clearance at 320 px. **Lighthouse (prod build, throttled mobile, local): Performance 90 · Accessibility 100 · Best Practices 100 · SEO 100 · CLS 0.049 · TBT 56 ms.** Contrast audit: every token pair ≥ 7.78:1 (AAA). Budgets: JS 86.8 KB gz of 100 · card 57 KB of 120 · bubbles ≤ 15.1 KB of 25 · initial payload ≈ 450 KB of 1.2 MB · 2 font families ✓ (font `<link rel=preload>` skipped — hashed filenames; the §6.1 curtain hides the swap window anyway). **One budget open: LCP 3.26 s vs 2.5 s — root-caused to design, not network:** the LCP element is the hero card, which fades in with the orchestrated entrance after the preloader curtain; LCP ≈ curtain exit + entrance by construction. Levers if the user wants 2.5 s: trim wipe/entrance (~0.3 s), drop Fraunces' SOFT/WONK axes file (~60 KB → ~0.4 s on 4G, loses §7's wonk), or accept 3.3 s as the price of the §6.1 moment. Cross-device QA on a midrange Android + full-site sign-off remain the user's (§12 P5 exit). Site is a v1.0.0 candidate pending: LCP call · §13.1 texts · sponsor data answers (§13.2/3, Kalm Studio, Dunkin', sponsor-form URL) · sign-off. No commit (git gate §1.2).
- **2026-07-22 · 0.0.1 staged ·** **Phase 4 built** (Phase 3 closed by the user's "start P4" unlock). **Key discovery:** `our_story.png` / `our_mission.png` / `our_visio.png` are *photographs* (Commerce Students' Society archive shot · members handing over a card · OSB 125-years gala), not text slides — so the actual Story/Mission/Vision copy exists nowhere in the handoff and §1.5 forbids authoring it. Journey ships structurally complete: real headings + those photos (converted to `public/assets/journey/*.webp`, 29–115 KB, lazy) + an honest "Text coming soon" line per card; **§13.1 text still owed and drops in with three one-line edits.** Built: `journey.js` — SVG path generated from measured node positions (S-curves desktop, straight rail mobile), stroke-dashoffset draw scrubbed to scroll, mini-card marker riding via native `getPointAtLength` on the same progress (MotionPathPlugin behavior without shipping it), node ignition keyed to exact per-node prefix path lengths so it can never drift, Join node ends the path at the membership CTA, font-reflow + resize rebuilds; `sponsorCta.js` — §6.6 section with stat row computed from `sponsors.js` (16 · 30% · 5 today), CTA on interim `mailto:` to the verified society email until the Google Form URL arrives (swap = one href). Fixed during verification: inline `--dot-x` styles beat the mobile media query (dots stuck at desktop positions on phones) → geometry moved fully into CSS; stale Lenis scroll limit after init-time height mutations meant the ST end was unreachable and **the Join node could never ignite** → new `scroll.refresh()` (lenis.resize + ScrollTrigger.refresh) after init and font-ready; one PowerShell text pass mojibake'd index.html's UTF-8 — repaired byte-exact, lesson recorded: Edit tool only for file content. Verified headless: 4-segment path, dasharray/offset math, scrub sync forward AND backward incl. un-ignition, marker on-path ≤1.5 px with clamped ±16° tilt, progress 1.0 + all four nodes lit at page bottom, card alternation 65/35/65/50, mobile rail (all dots x=38, path starts on rail), reduced-motion (fully drawn, all lit, marker hidden), stats fill, zero console errors, no overflow at 375/1280, build 86.2 KB JS gzip vs 100 KB budget. Left for the user: scroll-feel on real hardware, §13.1 text, sponsor-form URL. No commit (git gate §1.2).
- **2026-07-22 · 0.0.1 staged ·** **Phase 3 built** (Phase 2 closed by the user's "start P3" unlock). The Perk Field ships with the 16 verified sponsors — 16 logos converted to 320px webp bubbles (max 15.1 KB vs 25 KB budget); the 10 blocked sponsors stay listed in `sponsors.js` and join by adding one object + one image each. Built: `perkField.js` (packed-circle-with-jitter zone layout, responsive + size-weighted, 40-pass overlap relaxation; zero-gravity Matter world, rotation-locked circle bodies, restitution 0.2; home springs; soft personal-space repulsion; Lenis-velocity scroll impulses with deterministic per-body bias; displacement clamp with extra pull beyond radius; desktop pointer repulsor; fixed-timestep accumulator on gsap.ticker; IntersectionObserver zone activation + section pause + hidden-tab pause; mobile tuning knobs; all feel constants in a `TUNING` block for the live pass; reduced-motion = same packed cluster, static, engine never created), DOM renderer (real `<a>`/`<button>` bubbles, oblique −12° accent badges, spec aria-labels, translate3d writes only), `categoryRuler.js` (sticky rail, marker riding section progress, active label grows/accents; mobile edge rail + floating chip with text morph), `sponsorModal.js` (McDonald's popup: scale+fade, focus trap, ESC/backdrop, scroll lock, focus return). Preloader now tracks all 17 `[data-preload]` images per §6.1. Fixed during verification: gsap `clamp` arg order in bubble sizing; modal panel tween switched off `autoAlpha` so the synchronous focus move works. Verified headless (deterministic `stepOnce` stepping): settle ≤1 px, 323 px throw → home in ~1 s sim, pointer push 15.8 px/recovery 0.8 px, impulse path fires with per-body spread and stays bounded under an extreme velocity spike (speed cap + clamp), modal full cycle, ruler/chip wiring, mobile re-layout, reduced path, 0 overlaps at rest, 0 console errors, build 85.3 KB JS gzip vs 100 KB budget. Left for the user: 60 fps feel on real hardware, Android jank check, clamp feel ("mixed but not too much" — knobs in TUNING). No commit (git gate §1.2).
- **2026-07-22 · 0.0.1 staged ·** **Phase 2 built** (Phase 1 closed by the user's "start P2" unlock). Card art converted `assets/membership_card.png` → `public/assets/card/card-front.webp` (663×478, 57 KB vs 120 KB budget; source is 663px wide — fine at display size, a higher-res original can drop in with zero code changes). Headline locked to §6.3 option 1 "One card. A campus of perks." per the user's don't-ask directive — swap is one line in `index.html`. Built: honest preloader (tracks both font families + card art decode; floor 400 ms, hard cap 4 s; bar moves by CSS transition; reduced-motion = simple fade on timers, zero ticker dependency; inline critical CSS so the brand screen paints before the bundle; no-JS never sees it), `heroCard.js` (clamped ±12° tilt via quickTo, glare tracking pointer, shadow shifting opposite, idle float/sway loop, gyro only where it fires without a permission prompt — iOS 13+ keeps idle, pointer path only on `pointer: fine`), orchestrated entrance (masked headline lines with descender-safe clipping, card rise, staggered soft elements) fired as the preloader curtain lifts. Added `?reduced-motion` URL QA hook (scroll.js) and dev-only `window.__bss` handle; `sharp` as devDependency for asset conversion. Verified headless (manual gsap ticker stepping, since the detached pane has no rAF): full preloader→entrance choreography end states, tilt matrix + glare position/opacity + opposite shadow shift + pointerleave reset, reduced path end-to-end on timers alone, zero console errors, no horizontal overflow at 375/1280, correct card aspect, build green at 53.2 KB JS gzip (budget 100 KB). Left for the user's own eyes: 60 fps feel of tilt/entrance. No commit (git gate §1.2).
- **2026-07-22 · 0.0.1 staged ·** **Phase 1 built** (pending user sign-off). Vite 6 multi-page scaffold (index/account/404) per §4; deps installed (gsap, lenis, matter-js; Fraunces + Instrument Sans self-hosted variable woff2); `tokens.css` placeholder palette sampled from `assets/logo.png`/`membership_card.png` (maroon `#8e1e3f` family); Lenis + ScrollTrigger base with anchor gliding; navbar (glass after 80px, hide-down/show-up, full-screen hamburger with masked stagger, focus trap, ESC/backdrop close, scroll lock, active-section marker); footer with badge reading `version.json` (shows v0.0.1); `sponsors.js` seeded with 16 verified entries, 10 blocked entries listed in-file (§1.5); `static.yml`; README; `public/assets/` skeleton. Raw `assets/` folder gitignored (source material stays local). Build green — JS 51.9 KB gzip vs 100 KB budget (§8; Matter.js not imported until P3). Verified headless: landmarks, zero console errors, fonts load, no horizontal overflow at 375/1280, overlay open/ESC cycle incl. focus management, stub pages + base-path home links. Not verifiable headless: animation feel (browser pane had no rAF) — that judgment is the user's exit criterion anyway. No commit (git gate §1.2).
- **2026-07-22 · 0.0.1 staged ·** Plan adopted as CLAUDE.md (from `BSS-WEBSITE-PLAN.md`). Repo already wiped locally: the 8 old-site files are deleted but uncommitted, so Phase 1's first action is pre-done; deletion reaches GitHub on the first authorized push. Raw assets found in `assets/`: `logo.png`, `membership_card.png`, `our_story.png`, `our_mission.png`, `our_visio.png`, and 25 sponsor PNGs in `assets/Sponsored/`. **Roster note (needs user confirm before Phase 3):** those 25 PNGs = the §14 table minus Design Lab plus `thekalmstudio.png` (The Kalm Studio is not in §14); a prior session had locked "exclude Design Lab entirely". No phase active — awaiting "Start Phase 1".
