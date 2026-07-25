// Become a Sponsor (§6.6): stat row computed from sponsors.js so it can
// never go stale, plus a quiet one-shot reveal.
// v0.3.6: the numbers roll up to their real values as the row arrives.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { sponsors, categories } from '../data/sponsors.js';

export function initSponsorCta(scroll) {
  const root = document.querySelector('[data-sponsor-cta]');
  if (!root) return;

  const top = Math.max(...sponsors.map((s) => parseInt(s.discount, 10) || 0));
  const stats = [
    ['[data-stat-count]', sponsors.length, ''],
    ['[data-stat-top]', top, '%'],
    ['[data-stat-cats]', categories.length, ''],
  ];
  // resolved values are written immediately, so the row is correct and
  // readable even if the roll never runs
  stats.forEach(([sel, value, suffix]) => {
    const el = root.querySelector(sel);
    if (el) el.textContent = `${value}${suffix}`;
  });

  if (scroll.reduced) {
    root.classList.add('is-in');
    return;
  }

  /* Count up. Tweening a plain object and writing textContent keeps this off
     any layout-animated property: the digits change, the box does not move.
     Staggered so the three land in sequence rather than as one block, and
     snapped to integers so no frame ever shows 23.4 sponsors. */
  const roll = () => {
    stats.forEach(([sel, value, suffix], i) => {
      const el = root.querySelector(sel);
      if (!el) return;
      const o = { v: 0 };
      el.textContent = `0${suffix}`;
      gsap.to(o, {
        v: value,
        duration: 1.4,
        delay: 0.18 + i * 0.12,
        ease: 'power2.out',
        snap: { v: 1 },
        onUpdate: () => {
          el.textContent = `${o.v}${suffix}`;
        },
      });
    });
  };

  ScrollTrigger.create({
    trigger: root,
    start: 'top 75%',
    once: true,
    onEnter: () => {
      root.classList.add('is-in');
      roll();
    },
  });
}
