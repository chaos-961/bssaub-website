/* ------------------------------------------------------------------
   Login toast (v0.4.2, user brief: "when opening the website it should
   say with a simple popup from top in a good way Logged in as username").

   Slides out from BEHIND the navbar, holds, and retracts the same way.
   That is why its z-index sits below the bar's: the bar is an opaque
   paper sheet at 110, so a pill translating down from -140% is hidden by
   it until it clears the bar, and the motion reads as the toast coming
   out of the top edge of the page rather than fading in over it. It also
   sits below the dropdown menu (100) so a menu opened while the toast is
   still up is never covered by it.

   COST. No GSAP, no ticker, no observer. The whole look is two CSS
   transitions keyed off one class, and the node is only ever created when
   the session cookie exists — a signed out visitor pays nothing but the
   ~30 bytes of the early return.

   THE NAME IS UNTRUSTED. It arrives from a cookie (see session.js) and is
   written with textContent. Never innerHTML here, no matter how tempting
   the markup gets.
   ------------------------------------------------------------------ */
import { readSession } from './session.js';

const HOLD_MS = 5200;

export function initLoginToast({ delay = 0 } = {}) {
  const session = readSession();
  if (!session) return;

  const toast = document.createElement('div');
  toast.className = 'login-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const mark = document.createElement('span');
  mark.className = 'login-toast__mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = session.name.slice(0, 1).toUpperCase();

  const copy = document.createElement('span');
  copy.className = 'login-toast__copy';
  const label = document.createElement('span');
  label.className = 'login-toast__label';
  label.textContent = 'Logged in as';
  const name = document.createElement('strong');
  name.className = 'login-toast__name';
  name.textContent = session.name; // untrusted value, textContent only
  copy.append(label, name);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'login-toast__close';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  toast.append(mark, copy, dismiss);
  document.body.appendChild(toast);

  let hideTimer = 0;
  const hide = () => {
    window.clearTimeout(hideTimer);
    toast.classList.remove('is-in');
    // remove after the retract finishes; transitionend is unreliable here
    // because the element may already be display-collapsed by reduced motion
    window.setTimeout(() => toast.remove(), 700);
  };

  dismiss.addEventListener('click', hide);

  window.setTimeout(() => {
    /* No requestAnimationFrame here, deliberately. The usual double rAF trick
       exists to guarantee the parked state gets painted before the class flips,
       or the transition has no start value and the element simply appears. But
       rAF is THROTTLED whenever the page is not compositing (a background tab,
       an offscreen frame, a device mid gesture), and a throttled rAF does not
       run late, it does not run at all until compositing resumes — which was
       measured here: the node was appended at 648ms and the class never
       arrived, so the greeting sat parked above the viewport for its whole
       life. A forced layout read does the same job unconditionally, and it is
       one read on a node that was just created, not a per frame cost. */
    void toast.offsetWidth;
    toast.classList.add('is-in');
    hideTimer = window.setTimeout(hide, HOLD_MS);
  }, delay);
}
