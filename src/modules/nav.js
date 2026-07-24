// Navbar behavior: lift shadow after 80px, hide-on-scroll (slides up going
// down, drops back in going up — user call, brought back after the v0.1.4
// removal), active-section indicator, and a compact dropdown menu anchored
// under the hamburger (user call 2026-07-23 — replaced the §6.2 full-screen
// overlay). Dropdown closes on ESC, outside press, scroll movement, link
// click, or focus leaving.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const SECTION_HASHES = ['#top', '#sponsors', '#journey', '#become-a-sponsor'];

export function initNav(scroll) {
  const header = document.querySelector('[data-nav]');
  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.querySelector('[data-nav-overlay]');
  if (!header || !toggle || !menu) return;

  const links = Array.from(menu.querySelectorAll('a'));
  let isOpen = false;
  let lastY = window.scrollY;

  const REVEAL_AT = 90; // never hide within the first stretch of the page

  /* --- scrolled state + hide-on-scroll (+ close the menu on scroll) --- */
  const onScroll = (y) => {
    const delta = y - lastY;
    header.classList.toggle('is-scrolled', y > 80);
    // Slide the bar up when scrolling down, drop it back when scrolling up.
    // Never hide at the top or while the menu is open; a small deadzone keeps
    // Lenis micro-deltas from flickering it at a direction change.
    if (isOpen || y <= REVEAL_AT) header.classList.remove('is-hidden');
    else if (delta > 6) header.classList.add('is-hidden');
    else if (delta < -6) header.classList.remove('is-hidden');
    if (isOpen && Math.abs(delta) > 12) close({ returnFocus: false });
    lastY = y;
  };
  if (scroll.lenis) scroll.lenis.on('scroll', ({ scroll: y }) => onScroll(y));
  else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
  onScroll(window.scrollY);

  // keyboard users tabbing into the bar reveal it even while scrolled away
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

  /* --- dropdown open/close --- */
  gsap.set(menu, { autoAlpha: 0 });
  const tl = gsap
    .timeline({ paused: true, defaults: { ease: 'power3.out' } })
    .fromTo(
      menu,
      { autoAlpha: 0, y: -8, scale: 0.97 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' },
      0,
    )
    .fromTo(
      links,
      { opacity: 0, y: 7 },
      { opacity: 1, y: 0, duration: 0.32, stagger: 0.035 },
      0.05,
    );
  tl.eventCallback('onReverseComplete', () => menu.classList.remove('is-open'));

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    // GSAP flips visibility on its first tick, one frame after play() — force
    // it now so the focus move below lands (hidden elements refuse focus).
    menu.style.visibility = 'visible';
    if (scroll.reduced) tl.progress(1);
    else tl.timeScale(1).play();
    links[0]?.focus({ preventScroll: true });
  };

  const close = ({ returnFocus = true } = {}) => {
    if (!isOpen) return;
    isOpen = false;
    menu.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    if (scroll.reduced) {
      tl.progress(0);
      menu.classList.remove('is-open');
    } else {
      tl.timeScale(1.7).reverse();
    }
    if (returnFocus) toggle.focus({ preventScroll: true });
  };

  toggle.addEventListener('click', () => (isOpen ? close() : open()));

  // a press anywhere outside the panel (or the burger) dismisses it
  document.addEventListener('pointerdown', (e) => {
    if (!isOpen) return;
    if (menu.contains(e.target) || toggle.contains(e.target)) return;
    close({ returnFocus: false });
  });

  // dropdown pattern: tabbing out of the panel closes it, no focus trap
  menu.addEventListener('focusout', (e) => {
    if (!isOpen) return;
    const to = e.relatedTarget;
    if (to && !menu.contains(to) && to !== toggle) close({ returnFocus: false });
  });

  document.addEventListener('keydown', (e) => {
    if (!isOpen || e.key !== 'Escape') return;
    e.preventDefault();
    close();
  });

  /* --- menu anchor links: close first, then glide --- */
  menu.querySelectorAll('a[data-overlay-link]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const hash = a.getAttribute('href');
      // only pure in-page anchors — "./#section" URLs (account page) navigate normally
      const el = hash && hash.startsWith('#') && hash.length > 1 ? document.querySelector(hash) : null;
      if (!el) return;
      e.preventDefault();
      close({ returnFocus: false });
      requestAnimationFrame(() => {
        scroll.scrollTo(el);
        history.replaceState(null, '', hash);
      });
    });
  });

  /* --- active-section indicator --- */
  const byHash = new Map();
  menu.querySelectorAll('a[data-overlay-link]').forEach((a) => {
    byHash.set(a.getAttribute('href'), a);
  });
  SECTION_HASHES.forEach((hash) => {
    const sec = document.querySelector(hash);
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec,
      start: 'top center',
      end: 'bottom center',
      onToggle: (self) => {
        if (!self.isActive) return;
        menu.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
        byHash.get(hash)?.classList.add('is-active');
      },
    });
  });
}
