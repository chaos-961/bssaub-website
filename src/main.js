// Entry — module init order matters (§4): scroll first (Lenis + ScrollTrigger),
// nav consumes the scroll api, modal before the field (bubbles wire to it),
// the field builds its DOM before the preloader collects [data-preload] images.
// (categoryRuler retired 2026-07-23 — zone headings carry the category names.)
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/instrument-sans';

import './styles/tokens.css';
import './styles/base.css';
import './styles/reveal.css';
import './styles/site-bg.css';
import './styles/nav.css';
import './styles/sections.css';
import './styles/perk-field.css';
import './styles/modal.css';
import './styles/journey.css';
import './styles/sponsor-cta.css';
import './styles/agency-credit.css';
import './styles/toast.css';
import './styles/footer.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initScroll } from './modules/scroll.js';
import { initOceanMesh } from './modules/oceanMesh.js';
import { initNav } from './modules/nav.js';
import { initHeroCard } from './modules/heroCard.js';
import { initCardName } from './modules/cardName.js';
import { initSponsorModal } from './modules/sponsorModal.js';
import { initPerkField } from './modules/perkField.js';
import { initJourney } from './modules/journey.js';
import { initSponsorCta } from './modules/sponsorCta.js';
import { initAgencyCredit } from './modules/agencyCredit.js';
import { initReveal } from './modules/reveal.js';
import { initPreloader } from './modules/preloader.js';
import { initFooterVersion } from './modules/footerVersion.js';
import { initLoginToast } from './modules/loginToast.js';

const scroll = initScroll();
// the ocean takes scroll only to read its velocity (v0.3.6 surge); it still
// runs on its own clock and owns no part of the page's scroll behaviour
const ocean = initOceanMesh(scroll);
initNav(scroll);
const heroCard = initHeroCard(scroll);
// straight after the card it writes into, and independent of the entrance:
// heroCard returns early under reduced motion, cardName still fills the blank
initCardName(scroll);
const modal = initSponsorModal(scroll);
const perkField = initPerkField(scroll, modal);
const journey = initJourney(scroll);
initSponsorCta(scroll);
initAgencyCredit(scroll);
// reveal last of the animated modules: its triggers measure elements the
// field and the journey have already laid out
initReveal(scroll);
initFooterVersion();
scroll.refresh();
initPreloader({
  scroll,
  onComplete: () => {
    heroCard.enter();
    /* The greeting waits for the curtain (§6.1 covers the whole viewport at
       z-index 300, so a toast fired at load would simply be painted over and
       be half gone by the time it was visible), then for the hero entrance to
       have the stage to itself for a beat. It reads the session cookie and
       returns immediately if there is none, so a signed out visitor never
       pays for the timer. */
    initLoginToast({ delay: 900 });
  },
});

// dev-only handle for QA sessions (manual ticker stepping, state inspection)
if (import.meta.env.DEV) window.__bss = { gsap, scroll, perkField, modal, journey, ocean };
