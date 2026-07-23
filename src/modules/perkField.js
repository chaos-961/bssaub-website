// The Perk Field (§6.4): zero-gravity Matter.js world rendered through real
// DOM links/buttons. Zones lay out as packed circles with jitter; bodies get
// home springs, soft repulsion, Lenis scroll impulses with per-body bias, a
// displacement clamp ("mixed, but not too much") and a pointer repulsor.
// Reduced motion: physics off, same packed cluster rendered statically.
import Matter from 'matter-js';
import gsap from 'gsap';
import { sponsors, categories } from '../data/sponsors.js';

const { Engine, Bodies, Body, Composite } = Matter;

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
        return { sponsor: s, el, i, d: 0, r: 0, home: { x: 0, y: 0 }, body: null };
      });
    zones.push({ id: cat.id, canvas, items, active: true, offsetY: 0 });
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

    // zone offsets in section space + element home placement
    const secTop = section.getBoundingClientRect().top;
    zones.forEach((zone) => {
      zone.offsetY = zone.canvas.getBoundingClientRect().top - secTop;
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

  allItems.forEach((it) => {
    const zone = zones.find((z) => z.items.includes(it));
    it.bias = 0.7 + hash01(it.i * 3 + 1) * 0.6;         // per-body impulse bias
    it.biasX = (hash01(it.i * 5 + 2) - 0.5) * 0.5;      // slight lateral flavor
    it.body = Bodies.circle(it.home.x, it.home.y + zone.offsetY, it.r, {
      restitution: 0.2,
      frictionAir: 0.09,
      friction: 0,
      inertia: Infinity, // rotation locked — position moves, rotation never
    });
    Composite.add(engine.world, it.body);
  });

  /* ---------------- forces ---------------- */
  let pointer = null;
  if (window.matchMedia('(pointer: fine)').matches) {
    section.addEventListener('pointermove', (e) => {
      const r = section.getBoundingClientRect();
      pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    section.addEventListener('pointerleave', () => {
      pointer = null;
    });
  }

  let lenisVel = 0;
  scroll.lenis?.on('scroll', ({ velocity }) => {
    lenisVel = velocity;
  });

  const activeItems = () => zones.filter((z) => z.active).flatMap((z) => z.items);

  function applyForces() {
    const mobile = isMobile();
    const clampR = mobile ? TUNING.clampRadius.m : TUNING.clampRadius.d;
    const impulseK = mobile ? TUNING.impulse.m : TUNING.impulse.d;
    const maxSpeed = mobile ? TUNING.maxSpeed.m : TUNING.maxSpeed.d;
    const act = activeItems();

    act.forEach((it) => {
      const zone = zones.find((z) => z.items.includes(it));
      const b = it.body;
      const hx = it.home.x;
      const hy = it.home.y + zone.offsetY;
      const dx = hx - b.position.x;
      const dy = hy - b.position.y;
      const dist = Math.hypot(dx, dy);

      // home spring + displacement clamp: extra pull beyond the radius (§6.4)
      let k = TUNING.homeSpring;
      if (dist > clampR) k += TUNING.clampSpring * ((dist - clampR) / clampR);
      b.force.x += dx * k * b.mass;
      b.force.y += dy * k * b.mass;

      // lenis scroll impulse with per-body bias (§6.4)
      if (Math.abs(lenisVel) > 0.25) {
        Body.setVelocity(b, {
          x: b.velocity.x + lenisVel * impulseK * it.bias * it.biasX,
          y: b.velocity.y + lenisVel * impulseK * it.bias,
        });
      }

      // pointer as gentle repulsor (desktop, §6.4)
      if (pointer && !mobile) {
        const px = b.position.x - pointer.x;
        const py = b.position.y - pointer.y;
        const pd = Math.hypot(px, py);
        if (pd > 0.5 && pd < TUNING.pointerRadius + it.r) {
          const f = (1 - pd / (TUNING.pointerRadius + it.r)) ** 2 * TUNING.pointerPush;
          Body.setVelocity(b, {
            x: b.velocity.x + (px / pd) * f,
            y: b.velocity.y + (py / pd) * f,
          });
        }
      }

      // speed cap
      const sp = Math.hypot(b.velocity.x, b.velocity.y);
      if (sp > maxSpeed) {
        Body.setVelocity(b, {
          x: (b.velocity.x / sp) * maxSpeed,
          y: (b.velocity.y / sp) * maxSpeed,
        });
      }
    });

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
  }

  function render() {
    zones.forEach((zone) => {
      if (!zone.active) return;
      zone.items.forEach((it) => {
        const x = it.body.position.x - it.home.x;
        const y = it.body.position.y - (it.home.y + zone.offsetY);
        it.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      });
    });
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

  return { zones, layout, engine, applyForces, render, stepOnce, reduced: false };
}
