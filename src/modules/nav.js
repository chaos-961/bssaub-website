// Navbar behavior (§6.2): glass after 80px, hide down / show up,
// full-screen hamburger overlay with masked stagger, focus trap, ESC,
// backdrop close, scroll lock, active-section indicator.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const SECTION_HASHES = ['#top', '#sponsors', '#journey', '#become-a-sponsor'];

export function initNav(scroll) {
  const header = document.querySelector('[data-nav]');
  const toggle = document.querySelector('[data-nav-toggle]');
  const overlay = document.querySelector('[data-nav-overlay]');
  if (!header || !toggle || !overlay) return;

  const overlayLinks = Array.from(overlay.querySelectorAll('a'));
  let isOpen = false;
  let lastY = window.scrollY;

  /* --- scrolled state + hide-down/show-up --- */
  const onScroll = (y) => {
    header.classList.toggle('is-scrolled', y > 80);
    if (isOpen) return;
    const delta = y - lastY;
    if (y > 160 && delta > 6) header.classList.add('is-hidden');
    else if (delta < -6 || y <= 160) header.classList.remove('is-hidden');
    lastY = y;
  };
  if (scroll.lenis) scroll.lenis.on('scroll', ({ scroll: y }) => onScroll(y));
  else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
  onScroll(window.scrollY);

  /* --- overlay open/close --- */
  gsap.set(overlay, { autoAlpha: 0 });
  const tl = gsap
    .timeline({ paused: true, defaults: { ease: 'power3.out' } })
    .to(overlay, { autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, 0)
    .fromTo(
      overlayLinks,
      { yPercent: 115 },
      { yPercent: 0, duration: 0.75, stagger: 0.055 },
      0.08,
    );
  tl.eventCallback('onReverseComplete', () => overlay.classList.remove('is-open'));

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    header.classList.remove('is-hidden');
    scroll.lenis?.stop();
    document.documentElement.classList.add('u-scroll-lock');
    // GSAP flips visibility on its first tick, one frame after play() — force
    // it now so the focus move below lands (hidden elements refuse focus).
    overlay.style.visibility = 'visible';
    if (scroll.reduced) tl.progress(1);
    else tl.timeScale(1).play();
    overlayLinks[0]?.focus({ preventScroll: true });
  };

  const close = ({ returnFocus = true } = {}) => {
    if (!isOpen) return;
    isOpen = false;
    overlay.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    scroll.lenis?.start();
    document.documentElement.classList.remove('u-scroll-lock');
    if (scroll.reduced) {
      tl.progress(0);
      overlay.classList.remove('is-open');
    } else {
      tl.timeScale(1.6).reverse();
    }
    if (returnFocus) toggle.focus({ preventScroll: true });
  };

  toggle.addEventListener('click', () => (isOpen ? close() : open()));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      // trap: burger button + overlay links form the cycle
      const cycle = [toggle, ...overlayLinks];
      const i = cycle.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        cycle[cycle.length - 1].focus();
      } else if (!e.shiftKey && i === cycle.length - 1) {
        e.preventDefault();
        cycle[0].focus();
      }
    }
  });

  /* --- overlay anchor links: close first, then glide --- */
  overlay.querySelectorAll('a[data-overlay-link]').forEach((a) => {
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
  overlay.querySelectorAll('a[data-overlay-link]').forEach((a) => {
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
        overlay.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
        byHash.get(hash)?.classList.add('is-active');
      },
    });
  });
}
