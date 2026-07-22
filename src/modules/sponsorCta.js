// Become a Sponsor (§6.6): stat row computed from sponsors.js so it can
// never go stale, plus a quiet one-shot reveal.
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { sponsors, categories } from '../data/sponsors.js';

export function initSponsorCta(scroll) {
  const root = document.querySelector('[data-sponsor-cta]');
  if (!root) return;

  const top = Math.max(...sponsors.map((s) => parseInt(s.discount, 10) || 0));
  const set = (sel, v) => {
    const el = root.querySelector(sel);
    if (el) el.textContent = v;
  };
  set('[data-stat-count]', String(sponsors.length));
  set('[data-stat-top]', `${top}%`);
  set('[data-stat-cats]', String(categories.length));

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
