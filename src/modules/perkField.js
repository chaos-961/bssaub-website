// The Perk Field (§6.4): zero-gravity Matter.js world rendered through real
// DOM links/buttons. Zones lay out as packed circles with jitter; bodies get
// home springs, soft repulsion, Lenis scroll impulses with per-body bias, a
// displacement clamp ("mixed, but not too much") and a pointer repulsor.
// v0.0.4 juice: grab-and-throw, velocity squash-and-stretch ("jelly"), impact
// rim-flashes with contact sparks, stir currents off pointer velocity, idle
// breathing + random shivers, hover make-room.
// Reduced motion: physics off, same packed cluster rendered statically.
import Matter from 'matter-js';
import gsap from 'gsap';
import { sponsors, categories } from '../data/sponsors.js';

const { Engine, Bodies, Body, Composite, Events } = Matter;

const STEP = 1000 / 60; // fixed timestep, accumulator-driven (§6.4)

// Feel knobs — tuned live with the user (exit criterion). Desktop / mobile.
const TUNING = {
  homeSpring: 0.00016,      // pull toward home, per px displacement
  clampRadius: { d: 88, m: 46 },   // max casual drift from home (px)
  clampSpring: 0.0012,      // extra pull per px beyond the clamp radius
  softSpace: 14,            // personal space beyond touching (px)
  softPush: 0.018,          // velocity nudge per px of personal-space overlap
  impulse: { d: 0.011, m: 0.005 }, // lenis velocity → body velocity factor
  maxSpeed: { d: 15, m: 9 },
  pointerRadius: 150,
  pointerPush: 0.85,        // gentle repulsor strength (velocity nudge)
  stirPush: 1.2,            // pointer velocity (px/ms) → directional current
  hoverRadius: 84,          // make-room reach beyond touching (px)
  hoverPush: 0.4,
  holdMs: 160,              // touch: hold this long (without scrolling) to grab
  grabFollow: 0.34,         // fraction of the pointer gap closed per step
  grabMaxSpeed: 27,         // grabbed body tracks faster than the free cap
  flingCap: { d: 30, m: 20 },
  flingScale: 0.95,         // release velocity → body velocity factor
  throwRange: { d: 190, m: 120 }, // hard travel ceiling past clampRadius — a thrown
                            //    bubble stays in its neighborhood (2026-07-23 fix:
                            //    flings could sail under later sections = "disappeared")
  returnGlide: { d: 7, m: 5 },    // homeward speed cap beyond clampRadius — the
                            //    throw sails out fast, the comeback glides (was snapping)
  clampSpringMax: 1.4,      // cap on the clamp spring's distance multiplier
  hitSpeed: 2.4,            // min relative speed for an impact flash
  jellyK: 0.012,            // speed → squash-stretch amount
  jellyMax: 0.085,
  breatheAmp: 0.008,        // idle life: ±0.8% scale
  shiverKick: 1.5,          // occasional random nudge (fish-in-a-tank)
};

const isMobile = () =>
  window.matchMedia('(max-width: 47.99rem)').matches ||
  !window.matchMedia('(pointer: fine)').matches;

const hash01 = (n) => {
  const x = Math.sin((n + 1) * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
const jitter = (i, salt, amp) => (hash01(i * 7 + salt * 13) - 0.5) * 2 * amp;

const debounce = (fn, ms) => {
  let id;
  return () => {
    clearTimeout(id);
    id = setTimeout(fn, ms);
  };
};

export function initPerkField(scroll, modal) {
  const section = document.querySelector('[data-perk-field]');
  if (!section) return;

  /* ---------------- DOM build from sponsors.js ---------------- */
  const zones = [];
  const byEl = new Map();
  categories.forEach((cat) => {
    const canvas = section.querySelector(`[data-zone-canvas="${cat.id}"]`);
    if (!canvas) return;
    const items = sponsors
      .filter((s) => s.category === cat.id)
      .map((s, i) => {
        const hasDetails = !!s.details;
        const el = document.createElement(hasDetails ? 'button' : 'a');
        el.className = 'perk-bubble';
        if (hasDetails) {
          el.type = 'button';
          el.setAttribute('aria-haspopup', 'dialog');
        } else {
          el.href = s.instagram;
          el.target = '_blank';
          el.rel = 'noopener';
        }
        // literal discount text so the visible badge is part of the accessible
        // name (WCAG 2.5.3); screen readers pronounce "20% OFF" naturally.
        // discount: null (§1.5 unverified) → no badge, no % claim anywhere
        el.setAttribute(
          'aria-label',
          [s.name, s.discount, hasDetails ? 'opens offer details' : 'opens Instagram']
            .filter(Boolean)
            .join(', '),
        );
        el.innerHTML = `
          <span class="perk-bubble__scale">
            <img src="${s.image}" alt="" width="320" height="320" decoding="async" data-preload />
            ${s.discount ? `<span class="perk-bubble__badge" aria-hidden="true">${s.discount}</span>` : ''}
          </span>`;
        if (hasDetails) el.addEventListener('click', () => modal.open(s, el));
        canvas.appendChild(el);
        const it = { sponsor: s, el, i, d: 0, r: 0, home: { x: 0, y: 0 }, body: null };
        byEl.set(el, it);
        return it;
      });
    zones.push({ id: cat.id, canvas, items, active: true, offsetX: 0, offsetY: 0 });
  });

  const allItems = zones.flatMap((z) => z.items);
  if (!allItems.length) return;

  /* ---------------- layout: packed circles with jitter ---------------- */
  function layout() {
    zones.forEach((zone, zi) => {
      const W = Math.max(zone.canvas.clientWidth, 260); // guard degenerate embeds
      const base = gsap.utils.clamp(76, 118, W * 0.17); // gsap clamp = (min, max, value)
      const gapX = 16;
      const gapY = 8;
      const items = zone.items;

      // fill rows, then jitter + relax into an organic cluster
      const rows = [];
      let row = [];
      let rowW = 0;
      items.forEach((it) => {
        it.d = base * (it.sponsor.size || 1);
        it.r = it.d / 2;
        if (row.length && rowW + gapX + it.d > W * 0.94) {
          rows.push(row);
          row = [];
          rowW = 0;
        }
        rowW += (row.length ? gapX : 0) + it.d;
        row.push(it);
      });
      if (row.length) rows.push(row);

      let y = 18;
      rows.forEach((r, ri) => {
        const totalW = r.reduce((a, it) => a + it.d, 0) + gapX * (r.length - 1);
        let x = (W - totalW) / 2 + (ri % 2 ? base * 0.2 : -base * 0.14);
        const rowH = Math.max(...r.map((it) => it.d));
        r.forEach((it, ci) => {
          it.home.x = x + it.r + jitter(ci + ri * 7, zi + 1, base * 0.09);
          it.home.y = y + rowH / 2 + jitter(ci + ri * 5, zi + 9, base * 0.13);
          x += it.d + gapX;
        });
        y += rowH + gapY;
      });

      for (let k = 0; k < 40; k++) {
        let moved = false;
        for (let a = 0; a < items.length; a++) {
          for (let b = a + 1; b < items.length; b++) {
            const A = items[a].home;
            const B = items[b].home;
            const min = items[a].r + items[b].r + 10;
            let dx = B.x - A.x;
            let dy = B.y - A.y;
            const dist = Math.hypot(dx, dy) || 0.01;
            if (dist < min) {
              const push = (min - dist) / 2;
              dx /= dist;
              dy /= dist;
              A.x -= dx * push;
              A.y -= dy * push;
              B.x += dx * push;
              B.y += dy * push;
              moved = true;
            }
          }
        }
        items.forEach((it) => {
          it.home.x = gsap.utils.clamp(it.r + 2, W - it.r - 2, it.home.x);
          it.home.y = Math.max(it.r + 2, it.home.y);
        });
        if (!moved) break;
      }

      const maxY = items.length ? Math.max(...items.map((it) => it.home.y + it.r)) : 120;
      zone.canvas.style.height = `${Math.max(isMobile() ? 190 : 250, maxY + 26)}px`;
    });

    // zone offsets in section space + element home placement. Bodies live in
    // (canvas-local x, section-local y); offsetX maps pointer events into the
    // body X frame — the repulsor reads the cursor where it actually is.
    const secRect = section.getBoundingClientRect();
    zones.forEach((zone) => {
      const cRect = zone.canvas.getBoundingClientRect();
      zone.offsetX = cRect.left - secRect.left;
      zone.offsetY = cRect.top - secRect.top;
      zone.items.forEach((it) => {
        it.el.style.width = `${it.d}px`;
        it.el.style.height = `${it.d}px`;
        it.el.style.left = `${it.home.x - it.r}px`;
        it.el.style.top = `${it.home.y - it.r}px`;
      });
    });
  }

  layout();

  /* ---------------- reduced motion: static cluster grid, done ---------- */
  if (scroll.reduced) {
    window.addEventListener('resize', debounce(layout, 250));
    return { zones, layout, reduced: true };
  }

  /* ---------------- Matter world ---------------- */
  const engine = Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 0;

  const byBody = new Map();
  allItems.forEach((it) => {
    const zone = zones.find((z) => z.items.includes(it));
    it.zone = zone;
    it.bias = 0.7 + hash01(it.i * 3 + 1) * 0.6;         // per-body impulse bias
    it.biasX = (hash01(it.i * 5 + 2) - 0.5) * 0.5;      // slight lateral flavor
    it.deform = { k: 0, dx: 1, dy: 0 };                 // smoothed jelly state
    it.breathePhase = hash01(it.i * 17 + 3) * Math.PI * 2;
    it.breatheSpeed = 0.9 + hash01(it.i * 13 + 5) * 0.5;
    it.capBoost = 0;                                    // elevated cap after a fling
    it.hitAt = 0;
    it.grabbed = false;
    it.body = Bodies.circle(it.home.x, it.home.y + zone.offsetY, it.r, {
      restitution: 0.2,
      frictionAir: 0.09,
      friction: 0,
      inertia: Infinity, // rotation locked — position moves, rotation never
    });
    byBody.set(it.body, it);
    Composite.add(engine.world, it.body);
  });

  /* ---------------- pointer state: repulsor + stir + hover -------------- */
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  let pointer = null;                 // section-relative
  const pointerVel = { x: 0, y: 0 }; // smoothed px/ms — drives stir currents
  let lastPointerEv = null;
  let hoverIt = null;

  const sectionPoint = (e) => {
    const r = section.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  if (finePointer) {
    section.addEventListener('pointermove', (e) => {
      if (lastPointerEv) {
        const dt = Math.max(e.timeStamp - lastPointerEv.t, 1);
        pointerVel.x += ((e.clientX - lastPointerEv.x) / dt - pointerVel.x) * 0.35;
        pointerVel.y += ((e.clientY - lastPointerEv.y) / dt - pointerVel.y) * 0.35;
      }
      lastPointerEv = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      pointer = sectionPoint(e);
    });
    section.addEventListener('pointerleave', () => {
      pointer = null;
      lastPointerEv = null;
    });
    section.addEventListener('pointerover', (e) => {
      const el = e.target.closest('.perk-bubble');
      hoverIt = (el && byEl.get(el)) || null;
    });
    section.addEventListener('pointerout', (e) => {
      if (e.target.closest('.perk-bubble')) hoverIt = null;
    });
  }

  /* ---------------- grab-and-throw ---------------- */
  let grab = null;         // { it, pointerId, target, samples, dist, lastClient }
  let pendingTouch = null; // touch waiting for the hold timer (scroll wins on move)
  let suppressEl = null;   // swallow the click that follows a real drag
  let suppressUntil = 0;

  const blockTouch = (ev) => ev.preventDefault();

  function setTarget(e) {
    const p = sectionPoint(e);
    grab.target = { x: p.x - grab.it.zone.offsetX, y: p.y };
  }
  function pushSample(e) {
    grab.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (grab.samples.length > 6) grab.samples.shift();
  }

  function engageGrab(it, e) {
    hoverIt = null;
    it.grabbed = true;
    grab = { it, pointerId: e.pointerId, target: null, samples: [], dist: 0, lastClient: { x: e.clientX, y: e.clientY } };
    setTarget(e);
    pushSample(e);
    try {
      it.el.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported — window listeners still track the pointer */
    }
    it.el.classList.add('is-grabbed');
    document.documentElement.classList.add('is-grabbing');
    if (e.pointerType === 'touch') {
      window.addEventListener('touchmove', blockTouch, { passive: false });
      navigator.vibrate?.(8);
    }
  }

  function release(fling) {
    if (!grab) return;
    const it = grab.it;
    it.grabbed = false;
    if (fling && grab.samples.length >= 2) {
      const now = performance.now();
      const recent = grab.samples.filter((s) => now - s.t < 110);
      const a = recent[0] || grab.samples[0];
      const b = grab.samples[grab.samples.length - 1];
      const dt = Math.max(b.t - a.t, 8);
      let vx = ((b.x - a.x) / dt) * STEP * TUNING.flingScale;
      let vy = ((b.y - a.y) / dt) * STEP * TUNING.flingScale;
      const cap = isMobile() ? TUNING.flingCap.m : TUNING.flingCap.d;
      const sp = Math.hypot(vx, vy);
      if (sp > cap) {
        vx = (vx / sp) * cap;
        vy = (vy / sp) * cap;
      }
      Body.setVelocity(it.body, { x: vx, y: vy });
      if (sp > 2) it.capBoost = 1; // let a real throw sail before the cap reels it in
    }
    if (grab.dist > 6) {
      suppressEl = it.el;
      suppressUntil = performance.now() + 420;
    }
    try {
      it.el.releasePointerCapture(grab.pointerId);
    } catch {
      /* already released */
    }
    it.el.classList.remove('is-grabbed');
    document.documentElement.classList.remove('is-grabbing');
    window.removeEventListener('touchmove', blockTouch);
    grab = null;
  }

  section.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const el = e.target.closest('.perk-bubble');
    const it = el && byEl.get(el);
    if (!it) return;
    if (e.pointerType === 'touch') {
      // hold to grab; moving first hands the gesture to native scroll
      pendingTouch = {
        it,
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        ev: e,
        timer: setTimeout(() => {
          if (pendingTouch && pendingTouch.id === e.pointerId) {
            engageGrab(pendingTouch.it, pendingTouch.ev);
            pendingTouch = null;
          }
        }, TUNING.holdMs),
      };
    } else {
      engageGrab(it, e);
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (pendingTouch && e.pointerId === pendingTouch.id) {
      pendingTouch.ev = e;
      if (Math.hypot(e.clientX - pendingTouch.x0, e.clientY - pendingTouch.y0) > 9) {
        clearTimeout(pendingTouch.timer);
        pendingTouch = null;
      }
    }
    if (grab && e.pointerId === grab.pointerId) {
      setTarget(e);
      pushSample(e);
      grab.dist += Math.hypot(e.clientX - grab.lastClient.x, e.clientY - grab.lastClient.y);
      grab.lastClient = { x: e.clientX, y: e.clientY };
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (pendingTouch && e.pointerId === pendingTouch.id) {
      clearTimeout(pendingTouch.timer);
      pendingTouch = null;
    }
    if (grab && e.pointerId === grab.pointerId) release(true);
  });
  window.addEventListener('pointercancel', (e) => {
    if (pendingTouch && e.pointerId === pendingTouch.id) {
      clearTimeout(pendingTouch.timer);
      pendingTouch = null;
    }
    if (grab && e.pointerId === grab.pointerId) release(false);
  });
  window.addEventListener('blur', () => release(false));

  // a drag must not fire the tap action (link/modal) on release
  section.addEventListener(
    'click',
    (e) => {
      if (suppressEl && e.target.closest('.perk-bubble') === suppressEl && performance.now() < suppressUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
      suppressEl = null;
    },
    true,
  );
  section.addEventListener('dragstart', (e) => e.preventDefault());

  /* ---------------- impact flashes: rim ring + contact spark ------------ */
  const sparkLayer = document.createElement('div');
  sparkLayer.className = 'perk-sparks';
  sparkLayer.setAttribute('aria-hidden', 'true');
  section.appendChild(sparkLayer);
  const sparkPool = Array.from({ length: 6 }, () => {
    const s = document.createElement('span');
    s.className = 'perk-spark';
    s.addEventListener('animationend', () => s.classList.remove('is-on'));
    sparkLayer.appendChild(s);
    return s;
  });

  function flash(it) {
    const el = it.el;
    el.classList.remove('is-hit');
    void el.offsetWidth; // restart the animation
    el.classList.add('is-hit');
  }
  allItems.forEach((it) =>
    it.el.addEventListener('animationend', (e) => {
      if (e.animationName === 'perk-hit') it.el.classList.remove('is-hit');
    }),
  );

  function spark(a, b) {
    const s = sparkPool.find((el) => !el.classList.contains('is-on'));
    if (!s) return;
    const A = a.body.position;
    const B = b.body.position;
    const w = a.r / (a.r + b.r);
    s.style.left = `${(A.x + (B.x - A.x) * w + a.zone.offsetX).toFixed(1)}px`;
    s.style.top = `${(A.y + (B.y - A.y) * w).toFixed(1)}px`;
    s.classList.add('is-on');
  }

  let lastFlashAt = 0;
  Events.on(engine, 'collisionStart', (ev) => {
    const now = performance.now();
    if (now - lastFlashAt < 90) return; // big shoves must not strobe
    for (const pair of ev.pairs) {
      const a = byBody.get(pair.bodyA);
      const b = byBody.get(pair.bodyB);
      if (!a || !b) continue;
      const rel = Math.hypot(
        pair.bodyA.velocity.x - pair.bodyB.velocity.x,
        pair.bodyA.velocity.y - pair.bodyB.velocity.y,
      );
      if (rel < TUNING.hitSpeed) continue;
      if (now - a.hitAt < 260 || now - b.hitAt < 260) continue;
      a.hitAt = b.hitAt = lastFlashAt = now;
      flash(a);
      flash(b);
      spark(a, b);
      break;
    }
  });

  /* ---------------- forces ---------------- */
  let lenisVel = 0;
  scroll.lenis?.on('scroll', ({ velocity }) => {
    lenisVel = velocity;
  });

  const activeItems = () => {
    const act = zones.filter((z) => z.active).flatMap((z) => z.items);
    if (grab && !grab.it.zone.active) act.push(grab.it);
    return act;
  };

  let simT = 0;        // deterministic sim clock (breathing, shivers)
  let shiverAt = 3200;

  function applyForces() {
    const mobile = isMobile();
    const clampR = mobile ? TUNING.clampRadius.m : TUNING.clampRadius.d;
    const impulseK = mobile ? TUNING.impulse.m : TUNING.impulse.d;
    const maxSpeed = mobile ? TUNING.maxSpeed.m : TUNING.maxSpeed.d;
    const flingCap = mobile ? TUNING.flingCap.m : TUNING.flingCap.d;
    const act = activeItems();

    simT += STEP;
    if (simT >= shiverAt) {
      shiverAt = simT + 2200 + Math.random() * 2400;
      const pool = act.filter((x) => !x.grabbed);
      if (pool.length) {
        const s = pool[(Math.random() * pool.length) | 0];
        const ang = Math.random() * Math.PI * 2;
        const k = TUNING.shiverKick * (0.7 + Math.random() * 0.6);
        Body.setVelocity(s.body, {
          x: s.body.velocity.x + Math.cos(ang) * k,
          y: s.body.velocity.y + Math.sin(ang) * k,
        });
      }
    }

    act.forEach((it) => {
      const b = it.body;

      // grabbed body: velocity-follow the pointer (collisions still resolve,
      // so a dragged bubble plows through neighbors instead of teleporting)
      if (it.grabbed && grab) {
        let vx = (grab.target.x - b.position.x) * TUNING.grabFollow;
        let vy = (grab.target.y - b.position.y) * TUNING.grabFollow;
        const gsp = Math.hypot(vx, vy);
        if (gsp > TUNING.grabMaxSpeed) {
          vx = (vx / gsp) * TUNING.grabMaxSpeed;
          vy = (vy / gsp) * TUNING.grabMaxSpeed;
        }
        Body.setVelocity(b, { x: vx, y: vy });
        return;
      }

      const hx = it.home.x;
      const hy = it.home.y + it.zone.offsetY;
      let dx = hx - b.position.x;
      let dy = hy - b.position.y;
      let dist = Math.hypot(dx, dy);

      // hard travel ceiling: project runaway bodies back onto the ring and
      // strip the outward velocity component (tangential motion survives)
      const throwR = clampR + (mobile ? TUNING.throwRange.m : TUNING.throwRange.d);
      if (dist > throwR) {
        Body.setPosition(b, { x: hx - (dx / dist) * throwR, y: hy - (dy / dist) * throwR });
        const ox = -dx / dist;
        const oy = -dy / dist;
        const vr = b.velocity.x * ox + b.velocity.y * oy;
        if (vr > 0) {
          Body.setVelocity(b, { x: b.velocity.x - ox * vr, y: b.velocity.y - oy * vr });
        }
        it.capBoost = 0;
        dx = hx - b.position.x;
        dy = hy - b.position.y;
        dist = throwR;
      }

      // home spring + displacement clamp: extra pull beyond the radius (§6.4),
      // multiplier capped so far throws never build a snap-back force
      let k = TUNING.homeSpring;
      if (dist > clampR) {
        k += TUNING.clampSpring * Math.min((dist - clampR) / clampR, TUNING.clampSpringMax);
      }
      b.force.x += dx * k * b.mass;
      b.force.y += dy * k * b.mass;

      // lenis scroll impulse with per-body bias (§6.4)
      if (Math.abs(lenisVel) > 0.25) {
        Body.setVelocity(b, {
          x: b.velocity.x + lenisVel * impulseK * it.bias * it.biasX,
          y: b.velocity.y + lenisVel * impulseK * it.bias,
        });
      }

      // pointer repulsor + stir current: radial push away from the cursor,
      // plus a directional shove from pointer velocity (stirring water)
      if (pointer && !mobile && !grab) {
        const px = b.position.x - (pointer.x - it.zone.offsetX);
        const py = b.position.y - pointer.y;
        const pd = Math.hypot(px, py);
        const reach = TUNING.pointerRadius + it.r;
        if (pd > 0.5 && pd < reach) {
          const t = (1 - pd / reach) ** 2;
          const f = t * TUNING.pointerPush;
          Body.setVelocity(b, {
            x: b.velocity.x + (px / pd) * f + pointerVel.x * t * TUNING.stirPush,
            y: b.velocity.y + (py / pd) * f + pointerVel.y * t * TUNING.stirPush,
          });
        }
      }

      // speed cap — briefly elevated after a fling so throws can sail
      let cap = maxSpeed;
      if (it.capBoost > 0.01) {
        cap = maxSpeed + (flingCap - maxSpeed) * it.capBoost;
        it.capBoost *= 0.95;
      }
      const sp = Math.hypot(b.velocity.x, b.velocity.y);
      if (sp > cap) {
        Body.setVelocity(b, {
          x: (b.velocity.x / sp) * cap,
          y: (b.velocity.y / sp) * cap,
        });
      }

      // return glide: beyond the casual-drift radius, homeward radial speed is
      // trimmed to a calm glide (tangential swirl kept; the boost dies here so
      // the spring cannot ride an elevated cap back home)
      if (dist > clampR) {
        const inx = dx / dist;
        const iny = dy / dist;
        const vin = b.velocity.x * inx + b.velocity.y * iny;
        const glide = mobile ? TUNING.returnGlide.m : TUNING.returnGlide.d;
        if (vin > glide) {
          it.capBoost = 0;
          Body.setVelocity(b, {
            x: b.velocity.x - inx * (vin - glide),
            y: b.velocity.y - iny * (vin - glide),
          });
        }
      }
    });

    // hover make-room: neighbors politely part around the hovered bubble
    if (hoverIt && !grab && hoverIt.body) {
      const H = hoverIt.body.position;
      act.forEach((o) => {
        if (o === hoverIt) return;
        const dx = o.body.position.x - H.x;
        const dy = o.body.position.y - H.y;
        const d = Math.hypot(dx, dy);
        const reach = hoverIt.r + o.r + TUNING.hoverRadius;
        if (d > 0.5 && d < reach) {
          const f = (1 - d / reach) ** 2 * TUNING.hoverPush;
          Body.setVelocity(o.body, {
            x: o.body.velocity.x + (dx / d) * f,
            y: o.body.velocity.y + (dy / d) * f,
          });
        }
      });
    }

    // soft radial push on personal-space overlap — marbles, jelly (§6.4)
    for (let a = 0; a < act.length; a++) {
      for (let c = a + 1; c < act.length; c++) {
        const A = act[a].body;
        const B = act[c].body;
        const min = act[a].r + act[c].r + TUNING.softSpace;
        let dx = B.position.x - A.position.x;
        let dy = B.position.y - A.position.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        if (dist < min) {
          const push = (min - dist) * TUNING.softPush;
          dx /= dist;
          dy /= dist;
          Body.setVelocity(A, { x: A.velocity.x - dx * push, y: A.velocity.y - dy * push });
          Body.setVelocity(B, { x: B.velocity.x + dx * push, y: B.velocity.y + dy * push });
        }
      }
    }

    // scroll impulse decays if lenis goes quiet between events
    lenisVel *= 0.9;
    // stir current dies when the pointer rests
    pointerVel.x *= 0.88;
    pointerVel.y *= 0.88;
  }

  /* ---------------- render: position + jelly + breathing ---------------- */
  function renderItem(it) {
    const b = it.body;
    const x = b.position.x - it.home.x;
    const y = b.position.y - (it.home.y + it.zone.offsetY);

    // jelly: stretch along the (smoothed) velocity direction, squash across it
    const sp = Math.hypot(b.velocity.x, b.velocity.y);
    const kT = gsap.utils.clamp(0, TUNING.jellyMax, (sp - 1.1) * TUNING.jellyK);
    const D = it.deform;
    D.k += (kT - D.k) * 0.22;
    if (sp > 0.6) {
      D.dx += (b.velocity.x / sp - D.dx) * 0.3;
      D.dy += (b.velocity.y / sp - D.dy) * 0.3;
    }
    const breathe = 1 + TUNING.breatheAmp * Math.sin(simT * 0.00115 * it.breatheSpeed + it.breathePhase);

    let tf = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    if (D.k > 0.003) {
      const ang = Math.atan2(D.dy, D.dx);
      const sx = (breathe * (1 + D.k)).toFixed(4);
      const sy = (breathe * (1 - D.k * 0.85)).toFixed(4);
      tf += ` rotate(${ang.toFixed(3)}rad) scale(${sx}, ${sy}) rotate(${(-ang).toFixed(3)}rad)`;
    } else {
      tf += ` scale(${breathe.toFixed(4)})`;
    }
    it.el.style.transform = tf;
  }

  function render() {
    zones.forEach((zone) => {
      if (!zone.active) return;
      zone.items.forEach(renderItem);
    });
    if (grab && !grab.it.zone.active) renderItem(grab.it);
  }

  /* ---------------- stepping: fixed timestep + accumulator -------------- */
  let sectionNear = true;
  let acc = 0;
  const running = () => sectionNear && !document.hidden;

  gsap.ticker.add((t, dt) => {
    if (!running()) {
      acc = 0;
      return;
    }
    acc += Math.min(dt, 100);
    let stepped = false;
    while (acc >= STEP) {
      applyForces();
      Engine.update(engine, STEP);
      acc -= STEP;
      stepped = true;
    }
    if (stepped) render();
  });

  /* -------- activation: only near-viewport zones simulate (§6.4) -------- */
  if ('IntersectionObserver' in window) {
    const zoneIO = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          const zone = zones.find((z) => z.canvas === entry.target);
          if (zone) zone.active = entry.isIntersecting;
        }),
      { rootMargin: '35% 0px' },
    );
    zones.forEach((z) => zoneIO.observe(z.canvas));

    const sectionIO = new IntersectionObserver(
      ([entry]) => {
        sectionNear = entry.isIntersecting;
      },
      { rootMargin: '200px 0px' },
    );
    sectionIO.observe(section);
  }

  /* ---------------- resize ---------------- */
  window.addEventListener(
    'resize',
    debounce(() => {
      release(false);
      layout();
      zones.forEach((zone) => {
        zone.items.forEach((it) => {
          Body.setPosition(it.body, { x: it.home.x, y: it.home.y + zone.offsetY });
          Body.setVelocity(it.body, { x: 0, y: 0 });
          it.el.style.transform = 'translate3d(0px, 0px, 0)';
        });
      });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }, 250),
  );

  // stepOnce: one deterministic sim step outside the ticker — QA/tuning hook
  const stepOnce = () => {
    applyForces();
    Engine.update(engine, STEP);
  };

  return {
    zones,
    layout,
    engine,
    applyForces,
    render,
    stepOnce,
    reduced: false,
    _qa: {
      items: allItems,
      byEl,
      get grab() {
        return grab;
      },
      get hover() {
        return hoverIt;
      },
      get pointerVel() {
        return pointerVel;
      },
      shiverNow() {
        shiverAt = 0;
      },
      flash,
      spark,
    },
  };
}
