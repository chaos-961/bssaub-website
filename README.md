# BSS AUB Website

Rebuild of [bssaub.com](https://bssaub.com) for the AUB Business Student Society — a single scrollable page with one goal: get an AUB student to grab the membership card.

**Read `CLAUDE.md` before touching anything.** It is both the build plan and the operating contract: phase gates, git/deploy rules, the version contract, sponsor data rules, and the progress log.

## Stack

Vite · vanilla JS · GSAP + ScrollTrigger · Lenis · Matter.js · self-hosted variable fonts (Fraunces + Instrument Sans)

## Develop

```
npm install
npm run dev      # http://localhost:5173/bssaub-website/
npm run build    # outputs dist/
```

## Deploy

Every push to `main` builds and deploys to GitHub Pages via `.github/workflows/static.yml` — push means deploy. `version.json` is the version source of truth and must always match the footer badge.
