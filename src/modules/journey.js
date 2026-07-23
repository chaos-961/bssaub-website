// Our Journey (§6.5): one SVG path generated from the real node positions —
// S-curves on desktop, a straight-railed gentle line on mobile — drawn via
// stroke-dashoffset scrubbed to scroll. A glowing orb rides the draw front
// (native getPointAtLength, both directions, no MotionPathPlugin), trailing a
// blurred glow stroke. Nodes ignite when the front passes their exact path
// length — but ignition only drives the dot burst + frame glow. CONTENT
// REVEALS ARE SEPARATE AND ONCE-ONLY: each node gets its own one-shot
// ScrollTrigger, so a card that's on screen can never fade back out (the old
// is-lit coupling hid mid-viewport cards when the draw front lagged).
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const debounce = (fn, ms) => {
  let id;
  return () => {
    clearTimeout(id);
    id = setTimeout(fn, ms);
  };
};

export function initJourney(scroll) {
  const section = document.querySelector('[data-journey]');
  if (!section) return { setProgress: () => {} };

  const track = section.querySelector('[data-journey-track]');
  const svg = section.querySelector('[data-journey-svg]');
  const basePath = svg.querySelector('[data-path-base]');
  const glowPath = svg.querySelector('[data-path-glow]');
  const drawPath = svg.querySelector('[data-path-draw]');
  const marker = section.querySelector('[data-journey-marker]');
  const nodes = Array.from(section.querySelectorAll('[data-node]'));
  const dots = nodes.map((n) => n.querySelector('.journey-node__dot'));

  let totalLen = 0;
  let nodeLens = [];
  let lastProgress = 0;

  function buildPath() {
    // Desktop (user calls 2026-07-23): checkpoints sit beside their image
    // (measured px, recomputed every rebuild — the P4 --dot-x lesson) and the
    // path may NEVER cross a frame: it runs straight alongside each image at
    // the dot's x and does the whole S-swing in the vertical gaps between
    // frames. Mobile: the straight rail returned (second user call) — dots
    // back on the CSS rail, so inline positions are cleared, path is a line.
    const mobileNow = window.matchMedia('(max-width: 59.99rem)').matches;
    nodes.forEach((n, i) => {
      const dot = dots[i];
      if (!dot) return;
      const media = n.querySelector('.journey-node__media');
      if (mobileNow || !media) {
        dot.style.left = '';
        dot.style.top = '';
        return;
      }
      const liR = n.getBoundingClientRect();
      const mR = media.getBoundingClientRect();
      const odd = i % 2 === 0;
      const y = mR.top - liR.top + mR.height / 2;
      const x = odd ? mR.right - liR.left + 28 : mR.left - liR.left - 28;
      dot.style.left = `${x.toFixed(1)}px`;
      dot.style.top = `${y.toFixed(1)}px`;
    });

    const tr = track.getBoundingClientRect();
    const W = track.clientWidth;
    const H = track.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const dotPts = dots.map((d) => {
      const r = d.getBoundingClientRect();
      return { x: r.left - tr.left + r.width / 2, y: r.top - tr.top + r.height / 2 };
    });

    // waypoints, plus which point is each node's checkpoint (for ignition)
    const pts = [];
    const dotIdx = [];
    if (mobileNow) {
      pts.push({ x: dotPts[0].x, y: 0 }); // rail: enter straight above dot 1
      dotPts.forEach((p) => {
        dotIdx.push(pts.length);
        pts.push(p);
      });
    } else {
      const PAD = 24; // clearance above/below each frame before the swing
      pts.push({ x: W / 2, y: 0 });
      nodes.forEach((n, i) => {
        const media = n.querySelector('.journey-node__media');
        const p = dotPts[i];
        if (media) {
          const mR = media.getBoundingClientRect();
          pts.push({ x: p.x, y: mR.top - tr.top - PAD });
          dotIdx.push(pts.length);
          pts.push(p);
          pts.push({ x: p.x, y: mR.bottom - tr.top + PAD });
        } else {
          dotIdx.push(pts.length);
          pts.push(p);
        }
      });
    }

    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    const segs = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const my = ((a.y + b.y) / 2).toFixed(1);
      segs.push(` C ${a.x.toFixed(1)} ${my}, ${b.x.toFixed(1)} ${my}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
      d += segs[i - 1];
    }
    basePath.setAttribute('d', d);
    glowPath.setAttribute('d', d);
    drawPath.setAttribute('d', d);
    totalLen = drawPath.getTotalLength();

    // exact cumulative length at each checkpoint = prefix path length
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(probe);
    let acc = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    const cum = segs.map((seg) => {
      acc += seg;
      probe.setAttribute('d', acc);
      return probe.getTotalLength();
    });
    svg.removeChild(probe);
    nodeLens = dotIdx.map((k) => cum[k - 1]);

    drawPath.style.strokeDasharray = `${totalLen}`;
    glowPath.style.strokeDasharray = `${totalLen}`;
  }

  function update(p) {
    lastProgress = p;
    const off = `${totalLen * (1 - p)}`;
    drawPath.style.strokeDashoffset = off;
    glowPath.style.strokeDashoffset = off;
    const at = totalLen * p;
    if (marker) {
      const pt = drawPath.getPointAtLength(at);
      gsap.set(marker, { x: pt.x, y: pt.y });
    }
    // ignition = dot burst + frame glow only; content never keys off this
    nodes.forEach((n, i) => {
      n.classList.toggle('is-lit', at >= nodeLens[i] - 2);
    });
  }

  buildPath();

  if (scroll.reduced) {
    // fully drawn, everything lit + revealed, no marker, no scrub (§7)
    drawPath.style.strokeDashoffset = '0';
    glowPath.style.strokeDashoffset = '0';
    nodes.forEach((n) => n.classList.add('is-lit', 'is-in'));
    if (marker) marker.style.display = 'none';
    window.addEventListener('resize', debounce(buildPath, 250));
    document.fonts.ready.then(() => buildPath());
    return { setProgress: () => {} };
  }

  update(0);

  ScrollTrigger.create({
    trigger: track,
    start: 'top 62%',
    end: 'bottom 72%',
    scrub: true,
    onUpdate: (self) => update(self.progress),
    // orb pops in only while the journey is actually on screen
    onToggle: (self) => marker?.classList.toggle('is-active', self.isActive),
  });

  // once-only content reveals — the disappearing-card fix
  nodes.forEach((n) => {
    const img = n.querySelector('.journey-node__media img');
    ScrollTrigger.create({
      trigger: n,
      start: 'top 78%',
      once: true,
      onEnter: () => {
        n.classList.add('is-in');
        // Ken Burns settle: eases into the 1.12 resting scale the parallax uses
        if (img) gsap.fromTo(img, { scale: 1.24 }, { scale: 1.12, duration: 1.5, ease: 'power3.out' });
      },
    });
  });

  // slow parallax drift inside each clipped frame (the 1.12 scale is the crop margin)
  section.querySelectorAll('[data-journey-media] img').forEach((img) => {
    gsap.set(img, { scale: 1.12 });
    gsap.fromTo(
      img,
      { yPercent: -5 },
      {
        yPercent: 5,
        ease: 'none',
        scrollTrigger: {
          trigger: img.closest('[data-journey-media]'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });

  // ambient ember particles — paused whenever the section is off screen
  const pWrap = section.querySelector('[data-journey-particles]');
  if (pWrap) {
    const count = window.matchMedia('(max-width: 47.99rem)').matches ? 8 : 14;
    const drifts = [];
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'journey__particle';
      const size = 3 + Math.random() * 3.5;
      s.style.width = `${size}px`;
      s.style.height = `${size}px`;
      s.style.left = `${4 + Math.random() * 92}%`;
      s.style.top = `${8 + Math.random() * 88}%`;
      pWrap.appendChild(s);

      const dur = 6 + Math.random() * 7;
      const tl = gsap
        .timeline({ repeat: -1, repeatRefresh: true, delay: Math.random() * 6, paused: true })
        .fromTo(
          s,
          { y: 0, x: 0 },
          { y: () => -(50 + Math.random() * 90), x: () => (Math.random() - 0.5) * 44, duration: dur, ease: 'none' },
          0,
        )
        .fromTo(s, { opacity: 0 }, { opacity: () => 0.12 + Math.random() * 0.24, duration: dur * 0.35, ease: 'power1.inOut' }, 0)
        .to(s, { opacity: 0, duration: dur * 0.4, ease: 'power1.inOut' }, dur * 0.6);
      drifts.push(tl);
    }
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => drifts.forEach((tl) => (self.isActive ? tl.play() : tl.pause())),
    });
  }

  // magnetic Join CTA — the path ends on this button, so it pulls back a little
  const cta = section.querySelector('[data-journey-cta]');
  if (cta && window.matchMedia('(pointer: fine)').matches) {
    const qx = gsap.quickTo(cta, 'x', { duration: 0.4, ease: 'power3.out' });
    const qy = gsap.quickTo(cta, 'y', { duration: 0.4, ease: 'power3.out' });
    gsap.set(cta, { x: 0, y: 0 }); // own the transform from frame one
    const home = () => {
      qx(0);
      qy(0);
    };
    const field = cta.closest('.journey-node__card') || cta;
    field.addEventListener('pointermove', (e) => {
      const r = cta.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const R = 150;
      if (dist < R) {
        const f = (1 - dist / R) * 11;
        qx((dx / dist) * f);
        qy((dy / dist) * f);
      } else {
        home();
      }
    });
    field.addEventListener('pointerleave', home);
  }

  const rebuild = () => {
    buildPath();
    update(lastProgress);
  };
  window.addEventListener('resize', debounce(rebuild, 250));
  // headings reflow when the display font swaps in — rebuild against final metrics
  document.fonts.ready.then(() => {
    rebuild();
    scroll.refresh();
  });

  return { setProgress: update, rebuild };
}
