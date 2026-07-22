// Sponsor detail popup (§6.4): scale+fade in, focus trap, ESC/backdrop close,
// scroll locked while open, focus returned to the invoking bubble.
import gsap from 'gsap';

export function initSponsorModal(scroll) {
  const root = document.querySelector('[data-sponsor-modal]');
  if (!root) return { open: () => {} };

  const panel = root.querySelector('.sponsor-modal__panel');
  const backdrop = root.querySelector('[data-modal-backdrop]');
  const closeBtn = root.querySelector('[data-modal-close]');
  const img = root.querySelector('[data-modal-image]');
  const nameEl = root.querySelector('[data-modal-name]');
  const discountEl = root.querySelector('[data-modal-discount]');
  const summaryEl = root.querySelector('[data-modal-summary]');
  const notesEl = root.querySelector('[data-modal-notes]');
  const stepsEl = root.querySelector('[data-modal-steps]');
  const linksEl = root.querySelector('[data-modal-links]');
  const igEl = root.querySelector('[data-modal-ig]');

  let isOpen = false;
  let invoker = null;

  const fill = (s) => {
    img.src = s.image;
    nameEl.textContent = s.name;
    discountEl.textContent = s.discount;
    const d = s.details || {};
    summaryEl.textContent = d.summary || '';
    summaryEl.hidden = !d.summary;
    notesEl.textContent = d.notes || '';
    notesEl.hidden = !d.notes;
    stepsEl.innerHTML = '';
    stepsEl.hidden = !(d.steps && d.steps.length);
    (d.steps || []).forEach((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      stepsEl.appendChild(li);
    });
    linksEl.innerHTML = '';
    linksEl.hidden = !(d.links && d.links.length);
    (d.links || []).forEach((l) => {
      const a = document.createElement('a');
      a.className = 'btn btn--primary btn--sm';
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = l.label;
      linksEl.appendChild(a);
    });
    igEl.href = s.instagram;
  };

  const focusables = () =>
    Array.from(panel.querySelectorAll('button, a[href]')).filter((el) => !el.hidden);

  const open = (sponsor, fromEl) => {
    if (isOpen) return;
    isOpen = true;
    invoker = fromEl || null;
    fill(sponsor);
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    scroll.lenis?.stop();
    document.documentElement.classList.add('u-scroll-lock');
    if (!scroll.reduced) {
      gsap.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power2.out' });
      // opacity only — autoAlpha would set visibility:hidden and break the
      // synchronous focus move below (root .is-open owns visibility)
      gsap.fromTo(
        panel,
        { opacity: 0, scale: 0.92, y: 16 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'power3.out' },
      );
    }
    closeBtn.focus({ preventScroll: true });
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    root.setAttribute('aria-hidden', 'true');
    scroll.lenis?.start();
    document.documentElement.classList.remove('u-scroll-lock');
    const finish = () => {
      root.classList.remove('is-open');
      gsap.set([panel, backdrop], { clearProps: 'all' });
    };
    if (scroll.reduced) {
      finish();
    } else {
      gsap.to(panel, { opacity: 0, scale: 0.95, y: 10, duration: 0.22, ease: 'power2.in' });
      gsap.to(backdrop, { autoAlpha: 0, duration: 0.25, ease: 'power2.in', onComplete: finish });
    }
    invoker?.focus({ preventScroll: true });
    invoker = null;
  };

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      const els = focusables();
      if (!els.length) return;
      const i = els.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        els[els.length - 1].focus();
      } else if (!e.shiftKey && i === els.length - 1) {
        e.preventDefault();
        els[0].focus();
      }
    }
  });

  return { open, close };
}
