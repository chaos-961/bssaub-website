// Our Journey (§6.5): one SVG path generated from the real node positions —
// S-curves on desktop, a straight-railed gentle line on mobile — drawn via
// stroke-dashoffset scrubbed to scroll. A glowing mini-card marker rides the
// same progress (native getPointAtLength keeps it exactly on the draw front,
// both directions, without shipping MotionPathPlugin). Nodes ignite when the
// draw front passes their exact path length, so ignition can never drift.
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
  const drawPath = svg.querySelector('[data-path-draw]');
  const marker = section.querySelector('[data-journey-marker]');
  const nodes = Array.from(section.querySelectorAll('[data-node]'));
  const dots = nodes.map((n) => n.querySelector('.journey-node__dot'));

  let totalLen = 0;
  let nodeLens = [];
  let lastProgress = 0;

  function buildPath() {
    const tr = track.getBoundingClientRect();
    const W = track.clientWidth;
    const H = track.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const dotPts = dots.map((d) => {
      const r = d.getBoundingClientRect();
      return { x: r.left - tr.left + r.width / 2, y: r.top - tr.top + r.height / 2 };
    });
    // desktop: enter from top center; mobile rail: start straight above dot 1
    const start = W < 700 ? { x: dotPts[0].x, y: 0 } : { x: W / 2, y: 0 };
    const pts = [start, ...dotPts];

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
    drawPath.setAttribute('d', d);
    totalLen = drawPath.getTotalLength();

    // exact cumulative length at each node = prefix path length
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(probe);
    let acc = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    nodeLens = segs.map((seg) => {
      acc += seg;
      probe.setAttribute('d', acc);
      return probe.getTotalLength();
    });
    svg.removeChild(probe);

    drawPath.style.strokeDasharray = `${totalLen}`;
  }

  function update(p) {
    lastProgress = p;
    drawPath.style.strokeDashoffset = `${totalLen * (1 - p)}`;
    const at = totalLen * p;
    if (marker) {
      const pt = drawPath.getPointAtLength(at);
      const ahead = drawPath.getPointAtLength(Math.min(totalLen, at + 10));
      const ang = (Math.atan2(ahead.x - pt.x, ahead.y - pt.y) * 180) / Math.PI;
      gsap.set(marker, { x: pt.x, y: pt.y, rotation: gsap.utils.clamp(-16, 16, -ang) });
    }
    nodes.forEach((n, i) => {
      n.classList.toggle('is-lit', at >= nodeLens[i] - 2);
    });
  }

  buildPath();

  if (scroll.reduced) {
    // fully drawn, everything lit, no marker, no scrub (§7)
    drawPath.style.strokeDashoffset = '0';
    nodes.forEach((n) => n.classList.add('is-lit'));
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
  });

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
