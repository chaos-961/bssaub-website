// Agency credit (Nerve Media section): quiet one-shot reveal, same
// pattern as the sponsor CTA. Decorative only — no data to compute.
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initAgencyCredit(scroll) {
  const root = document.querySelector('[data-agency-credit]');
  if (!root) return;

  if (scroll.reduced) {
    root.classList.add('is-in');
    return;
  }
  ScrollTrigger.create({
    trigger: root,
    start: 'top 80%',
    once: true,
    onEnter: () => root.classList.add('is-in'),
  });
}
