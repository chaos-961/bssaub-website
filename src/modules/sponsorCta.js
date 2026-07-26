// Become a Sponsor (§6.6): a quiet one-shot reveal.
// v0.3.6 added a stat row that counted up to values computed from sponsors.js;
// the row was removed entirely on the user's word after v0.4.0, so the roll
// went with it. Do not rebuild either without a fresh brief.
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initSponsorCta(scroll) {
  const root = document.querySelector('[data-sponsor-cta]');
  if (!root) return;

  if (scroll.reduced) {
    root.classList.add('is-in');
    return;
  }

  ScrollTrigger.create({
    trigger: root,
    start: 'top 75%',
    once: true,
    onEnter: () => root.classList.add('is-in'),
  });
}
