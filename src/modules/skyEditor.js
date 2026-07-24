// ---------------------------------------------------------------------------
// Drawing authoring tool (?skyEditor=1) — dev only, lazy loaded by starfield.js
// so it never ships in a normal page load. Building ~20 figures by hand would
// be miserable otherwise: this is a blank stage where you click to place stars,
// click two stars to wire an edge, preview the trace and the chaos jitter, and
// export a drawing object with normalized coordinates ready to paste into
// src/data/drawings.js.
//
//   click empty space  → place a point
//   click a point      → select it; click a second point → wire an edge
//                         (selection hops to the second point so you can chain)
//   Undo               → drop the last point or edge
//   Chaos slider       → preview how the shape distorts at that chaos
//   Trace              → play the pen across the current edges
//   Export JSON        → normalized drawing object, plus Copy to clipboard
// ---------------------------------------------------------------------------

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const HIT = 12; // px radius for clicking an existing point

export function initSkyEditor(cfg) {
  const COLOR = (cfg && cfg.starColor) || '237, 233, 224';

  // -- DOM --------------------------------------------------------------------
  const root = document.createElement('div');
  root.className = 'sky-editor';
  root.innerHTML = `
    <div class="sky-editor__bar">
      <strong>Sky drawing editor</strong>
      <label>id <input type="text" data-id value="new-drawing" /></label>
      <label>chaos <input type="range" data-chaos min="0" max="0.6" step="0.01" value="0.35" /><span data-chaosval>0.35</span></label>
      <button class="sky-editor__btn" data-undo>Undo</button>
      <button class="sky-editor__btn" data-clear>Clear</button>
      <button class="sky-editor__btn" data-preview>Trace ▸</button>
      <button class="sky-editor__btn sky-editor__btn--go" data-export>Export JSON</button>
      <button class="sky-editor__btn" data-copy>Copy</button>
      <span class="sky-editor__hint" data-hint>click to place a point · click two points to wire an edge</span>
    </div>
    <div class="sky-editor__stage" data-stage>
      <canvas data-canvas></canvas>
      <pre class="sky-editor__out" data-out hidden></pre>
    </div>`;
  document.body.appendChild(root);

  const stage = root.querySelector('[data-stage]');
  const canvas = root.querySelector('[data-canvas]');
  const out = root.querySelector('[data-out]');
  const idInput = root.querySelector('[data-id]');
  const chaosInput = root.querySelector('[data-chaos]');
  const chaosVal = root.querySelector('[data-chaosval]');
  const hint = root.querySelector('[data-hint]');
  const ctx = canvas.getContext('2d');

  // -- state ------------------------------------------------------------------
  const points = []; // {x, y} in css px on the stage
  const edges = []; // [i, j]
  const history = []; // {type:'point'|'edge'} for undo
  let selected = -1;
  let dpr = 1;
  let preview = null; // {edge, t, phase, timer} while the trace plays

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const r = stage.getBoundingClientRect();
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // -- geometry for the chaos preview -----------------------------------------
  // jitter scaled to how the shape reads at real placement (~310px longest side)
  function jitteredPoints() {
    const chaos = Number(chaosInput.value);
    if (chaos <= 0 || points.length === 0) return points.map((p) => ({ ...p }));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const longest = Math.max(maxX - minX, maxY - minY) || 1;
    const mag = chaos * 14 * (longest / 310);
    const rng = mulberry32(1337);
    return points.map((p) => ({ x: p.x + (rng() * 2 - 1) * mag, y: p.y + (rng() * 2 - 1) * mag }));
  }

  // -- drawing ----------------------------------------------------------------
  function draw() {
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    const pts = jitteredPoints();

    // edges
    ctx.strokeStyle = `rgba(${COLOR}, 0.5)`;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    const drawnEdges = preview ? preview.upto : edges.length;
    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i];
      if (!pts[a] || !pts[b]) continue;
      let tEnd = 1;
      if (preview) {
        if (i > drawnEdges) continue;
        if (i === drawnEdges) tEnd = preview.phase === 'pause' ? 1 : easeInOut(preview.t);
      }
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[a].x + (pts[b].x - pts[a].x) * tEnd, pts[a].y + (pts[b].y - pts[a].y) * tEnd);
      ctx.stroke();
    }

    // points
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      ctx.beginPath();
      ctx.fillStyle = i === selected ? '#cf3f5f' : `rgba(${COLOR}, 0.95)`;
      ctx.arc(p.x, p.y, i === selected ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(String(i), p.x + 7, p.y - 6);
    }
  }

  // -- interaction ------------------------------------------------------------
  function hitTest(x, y) {
    for (let i = points.length - 1; i >= 0; i--) {
      if (Math.hypot(points[i].x - x, points[i].y - y) <= HIT) return i;
    }
    return -1;
  }

  canvas.addEventListener('click', (e) => {
    if (preview) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const hit = hitTest(x, y);
    if (hit >= 0) {
      if (selected >= 0 && selected !== hit) {
        edges.push([selected, hit]);
        history.push({ type: 'edge' });
        selected = hit; // chain from the point just wired
      } else {
        selected = hit;
      }
    } else {
      points.push({ x, y });
      history.push({ type: 'point' });
      selected = -1;
    }
    draw();
  });

  root.querySelector('[data-undo]').addEventListener('click', () => {
    const last = history.pop();
    if (!last) return;
    if (last.type === 'edge') edges.pop();
    else points.pop();
    selected = -1;
    draw();
  });

  root.querySelector('[data-clear]').addEventListener('click', () => {
    points.length = 0;
    edges.length = 0;
    history.length = 0;
    selected = -1;
    out.hidden = true;
    draw();
  });

  chaosInput.addEventListener('input', () => {
    chaosVal.textContent = Number(chaosInput.value).toFixed(2);
    draw();
  });

  // -- trace preview ----------------------------------------------------------
  root.querySelector('[data-preview]').addEventListener('click', () => {
    if (preview || edges.length === 0) return;
    preview = { upto: 0, t: 0, phase: 'draw', timer: 0, last: performance.now() };
    hint.textContent = 'tracing…';
    requestAnimationFrame(stepPreview);
  });

  function stepPreview(now) {
    if (!preview) return;
    const dt = now - preview.last;
    preview.last = now;
    const SEG = 200;
    const PAUSE = 90;
    if (preview.phase === 'draw') {
      preview.timer += dt;
      preview.t = Math.min(1, preview.timer / SEG);
      if (preview.t >= 1) {
        preview.phase = 'pause';
        preview.timer = 0;
      }
    } else {
      preview.timer += dt;
      if (preview.timer >= PAUSE) {
        preview.upto++;
        preview.timer = 0;
        preview.t = 0;
        preview.phase = 'draw';
      }
    }
    draw();
    if (preview.upto >= edges.length) {
      preview = null;
      hint.textContent = 'click to place a point · click two points to wire an edge';
      draw();
      return;
    }
    requestAnimationFrame(stepPreview);
  }

  // -- export -----------------------------------------------------------------
  function buildExport() {
    if (points.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    // normalize with a single scale so the figure keeps its true aspect, the
    // longest side spanning [0, 1] — exactly how the starfield reads a drawing
    const scale = Math.max(maxX - minX, maxY - minY) || 1;
    const round = (n) => Math.round((n / scale) * 1000) / 1000;
    const obj = {
      id: idInput.value.trim() || 'new-drawing',
      chaos: Number(chaosInput.value),
      points: points.map((p) => [round(p.x - minX), round(p.y - minY)]),
      edges: edges.map((e) => [e[0], e[1]]),
    };
    return obj;
  }

  function serialize(obj) {
    const pts = obj.points.map((p) => `[${p[0]}, ${p[1]}]`).join(', ');
    const eds = obj.edges.map((e) => `[${e[0]}, ${e[1]}]`).join(', ');
    return `{\n  id: '${obj.id}',\n  chaos: ${obj.chaos},\n  points: [${pts}],\n  edges: [${eds}],\n}`;
  }

  root.querySelector('[data-export]').addEventListener('click', () => {
    const obj = buildExport();
    if (!obj) return;
    out.textContent = serialize(obj);
    out.hidden = false;
  });

  root.querySelector('[data-copy]').addEventListener('click', async () => {
    const obj = buildExport();
    if (!obj) return;
    const text = serialize(obj);
    out.textContent = text;
    out.hidden = false;
    try {
      await navigator.clipboard.writeText(text);
      hint.textContent = 'copied to clipboard';
      setTimeout(() => (hint.textContent = 'click to place a point · click two points to wire an edge'), 1600);
    } catch {
      /* clipboard blocked — the JSON is shown in the panel to copy by hand */
    }
  });

  window.addEventListener('resize', resize);
  resize();
}

export default initSkyEditor;
