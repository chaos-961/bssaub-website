// Entry — module init order matters (§4): scroll first (Lenis + ScrollTrigger),
// nav consumes the scroll api, modal before the field (bubbles wire to it),
// the field builds its DOM before the preloader collects [data-preload] images.
// (categoryRuler retired 2026-07-23 — zone headings carry the category names.)
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/instrument-sans';

import './styles/tokens.css';
import './styles/base.css';
import './styles/starfield.css';
import './styles/nav.css';
import './styles/sections.css';
import './styles/perk-field.css';
import './styles/modal.css';
import './styles/journey.css';
import './styles/sponsor-cta.css';
import './styles/agency-credit.css';
import './styles/footer.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initScroll } from './modules/scroll.js';
import { initNav } from './modules/nav.js';
import { initStarfield } from './modules/starfield.js';
import { initHeroCard } from './modules/heroCard.js';
import { initSponsorModal } from './modules/sponsorModal.js';
import { initPerkField } from './modules/perkField.js';
import { initJourney } from './modules/journey.js';
import { initSponsorCta } from './modules/sponsorCta.js';
import { initAgencyCredit } from './modules/agencyCredit.js';
import { initPreloader } from './modules/preloader.js';
import { initFooterVersion } from './modules/footerVersion.js';

const scroll = initScroll();
initNav(scroll);
const heroCard = initHeroCard(scroll);
const modal = initSponsorModal(scroll);
const perkField = initPerkField(scroll, modal);
const journey = initJourney(scroll);
initSponsorCta(scroll);
initAgencyCredit(scroll);
// Generative sky background layer: builds its canvas + seeded field now (reads
// final-ish page height after the sections above exist), then holds its pop-in
// until the preloader hands off, so stars bloom in step with the hero entrance.
const starfield = initStarfield({ reduced: scroll.reduced });
initFooterVersion();
scroll.refresh();
initPreloader({
  scroll,
  onComplete: () => {
    heroCard.enter();
    starfield.begin();
  },
});

// dev-only handle for QA sessions (manual ticker stepping, state inspection)
if (import.meta.env.DEV) window.__bss = { gsap, scroll, perkField, modal, journey, starfield };
