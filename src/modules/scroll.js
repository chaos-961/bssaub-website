// Lenis + ScrollTrigger wiring (§4). Owns smooth scrolling and in-page
// anchor gliding; later modules (perkField) read lenis velocity from here.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

// ?reduced-motion QA hook: lets any device exercise the reduced path (§7)
const REDUCED =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
  new URLSearchParams(window.location.search).has('reduced-motion');

function navOffset() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--nav-h');
  return (parseInt(raw, 10) || 72) + 12;
}

export function initScroll() {
  gsap.registerPlugin(ScrollTrigger);

  let lenis = null;
  if (!REDUCED) {
    lenis = new Lenis({ duration: 1.15 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  const api = {
    lenis,
    reduced: REDUCED,
    // re-measure after init-time layout mutations (zone heights, journey
    // heights) — deterministic complement to Lenis's own ResizeObserver
    refresh() {
      lenis?.resize();
      ScrollTrigger.refresh();
    },
    scrollTo(target) {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) return;
      if (lenis) lenis.scrollTo(el, { offset: -navOffset(), duration: 1.2 });
      else el.scrollIntoView({ block: 'start' });
    },
  };

  // Glide every in-page anchor except overlay links (nav.js owns those — the
  // overlay has to close and unlock scrolling first) and the skip link
  // (default jump + focus behavior is the accessible one).
  document.querySelectorAll('a[href^="#"]:not([data-overlay-link]):not(.skip-link)').forEach((a) => {
    a.addEventListener('click', (e) => {
      const hash = a.getAttribute('href');
      if (!hash || hash.length <= 1) return;
      const el = document.querySelector(hash);
      if (!el) return;
      e.preventDefault();
      api.scrollTo(el);
      history.replaceState(null, '', hash);
    });
  });

  return api;
}
