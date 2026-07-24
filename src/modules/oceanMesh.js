/* ------------------------------------------------------------------
   Ocean mesh (v0.3.2, user brief): the low poly background swells like a
   slow sea and its colour drifts through the rose family.

   WHY WEBGL, given this repo's history of ripping WebGL backgrounds out.
   The brief asks for ~2400 moving vertices and a per facet colour that
   changes over time. The honest options:
     - Canvas 2D: 800 fill() calls per frame on the MAIN THREAD. At 30fps
       that is 24k path fills a second competing with Lenis, GSAP and the
       Matter.js perk field. This is the expensive option, not the cheap one.
     - SVG/CSS: cannot move individual vertices at all without re-emitting
       the whole path set per frame, which is worse than canvas.
     - WebGL: one draw call, 2400 vertices, displacement in the vertex
       shader. The GPU does what it is built for and the main thread does
       essentially nothing.
   So WebGL is chosen here BECAUSE of the perf constraint, not despite it.

   WHAT KEEPS IT CHEAP (all of this is load bearing):
     - One draw call per frame. No per frame allocation, no buffer re-upload:
       positions are uploaded once and only uniforms change.
     - 30fps cap. The motion is a slow swell; 60fps buys nothing visible and
       costs double.
     - Backing store pinned to DPR 1. Adjacent facets differ by only a few
       levels, so their edges are nearly invisible and there is nothing for
       extra resolution to sharpen. On a 2x display this is a 4x saving in
       fragments for no perceptible loss.
     - The fragment shader is a varying plus one hash. Effectively a screen
       fill.
     - Fully parked when the tab is hidden, and torn down on context loss.
     - prefers-reduced-motion never creates it at all.

   FALLBACK. The static mesh.svg stays as the CSS background underneath and
   is what paints before the bundle arrives, when JS is off, when motion is
   reduced, and when WebGL is unavailable. The canvas is built from the SAME
   lattice (src/lib/mesh.js), so its rest state is the same mesh and the
   fade in is seamless rather than a jump.
   ------------------------------------------------------------------ */
import {
  MESH,
  buildGeometry,
  gradientT,
  rampStops,
  cycleBase,
} from '../lib/mesh.js';

const FPS = 30;
const FRAME_MS = 1000 / FPS;

/* Swell amplitude in mesh units. A cell is 70, so peak displacement of
   ~11 units is about 16% of a cell: the surface breathes, facets never
   tangle or invert. Past roughly 25% the triangles start crossing each
   other and it reads as static noise rather than water. */
const AMP = 7.0;

/* The mesh is drawn slightly larger than `cover` requires so that vertices
   on the outer ring can move without ever pulling a gap in at the screen
   edge. Must exceed peak displacement: 4% of 1400 is 28 units a side
   against a peak of ~11. */
const OVERSCAN = 1.04;

/* Seconds for one full trip around PALETTE_CYCLE. Long enough that the
   colour change is felt rather than watched. */
const CYCLE_S = 96;

const VERT = `
/* highp, not mediump: mesh coordinates run to 1400 and mediump carries only
   ~10 bits of mantissa, which quantises positions to whole units and makes
   the swell visibly snap between steps instead of gliding. */
precision highp float;
attribute vec2 aPos;
attribute float aRamp;   // ramp position of this facet's centroid, 0..1
attribute float aScatter;

uniform vec2 uA;      // mesh space -> clip space scale
uniform vec2 uB;      // mesh space -> clip space offset
uniform float uTime;
uniform float uAmp;
uniform float uDrift;
uniform vec3 uS0, uS1, uS2, uS3;

varying vec3 vCol;

/* Two crossed swells per axis at different frequencies and speeds. Phase
   comes from the vertex's own position, so neighbours move together and the
   whole thing reads as one surface instead of per triangle jitter. */
vec2 swell(vec2 p, float t) {
  float a = sin(p.y * 0.0052 + t * 0.55) + 0.6 * sin(p.x * 0.0037 - t * 0.41);
  float b = cos(p.x * 0.0045 + t * 0.47) + 0.6 * cos((p.x + p.y) * 0.0029 + t * 0.33);
  return vec2(a, b);
}

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.36) return mix(uS0, uS1, t / 0.36);
  if (t < 0.72) return mix(uS1, uS2, (t - 0.36) / 0.36);
  return mix(uS2, uS3, (t - 0.72) / 0.28);
}

void main() {
  vec2 p = aPos + swell(aPos, uTime) * uAmp;
  gl_Position = vec4(p * uA + uB, 0.0, 1.0);

  /* Colour is sampled at the triangle's CENTROID, not the vertex, so all
     three vertices of a facet carry the same value and the interpolated
     varying comes out flat. That is what keeps the faceted look without
     needing WebGL2's flat qualifier. */
  vCol = clamp(ramp(aRamp + uDrift) + aScatter, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec3 vCol;

/* Screen space dither. Doubles as the paper grain the CSS layer provides on
   the static path, and breaks up banding in the ramp. Kept subtle: it
   darkens by at most ~2%, which is inside the contrast budget. */
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float n = hash(gl_FragCoord.xy);
  gl_FragColor = vec4(vCol * (1.0 - 0.02 * n), 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('shader: ' + log);
  }
  return sh;
}

export function initOceanMesh() {
  const host = document.querySelector('.site-bg');
  if (!host) return null;

  // the OS asked for calm: leave the static mesh alone, build nothing
  const reduced =
    document.documentElement.classList.contains('reduced-motion') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'site-bg__canvas';
  canvas.setAttribute('aria-hidden', 'true');

  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false, // facet edges differ by a few levels; nothing to smooth
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    });
  } catch {
    gl = null;
  }
  if (!gl) return null; // static mesh.svg stays, which is a complete background

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('link: ' + gl.getProgramInfoLog(program));
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[oceanMesh]', err);
    return null;
  }

  host.appendChild(canvas);
  gl.useProgram(program);

  /* ---- buffers, uploaded once and never touched again ---- */
  const { triangles } = buildGeometry();
  const n = triangles.length * 3;
  const pos = new Float32Array(n * 2);
  const ramp = new Float32Array(n);
  const sca = new Float32Array(n);

  let i = 0;
  for (const tri of triangles) {
    // the centroid's ramp position is resolved once here, on the CPU, rather
    // than recomputed identically for all three vertices in the shader
    const gt = gradientT(tri.cx, tri.cy);
    for (const [x, y] of tri.v) {
      pos[i * 2] = x;
      pos[i * 2 + 1] = y;
      ramp[i] = gt;
      sca[i] = tri.scatter;
      i++;
    }
  }

  const mkBuf = (data, size, name) => {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    return buf;
  };
  mkBuf(pos, 2, 'aPos');
  mkBuf(ramp, 1, 'aRamp');
  mkBuf(sca, 1, 'aScatter');

  const u = {};
  for (const name of ['uA', 'uB', 'uTime', 'uAmp', 'uDrift', 'uS0', 'uS1', 'uS2', 'uS3']) {
    u[name] = gl.getUniformLocation(program, name);
  }
  gl.uniform1f(u.uAmp, AMP);

  /* ---- viewport fit: `cover` plus overscan, mesh space to clip space ---- */
  let w = 0;
  let h = 0;
  function resize() {
    const dpr = 1; // see the header: extra resolution buys nothing here
    /* Measure the CANVAS's own rendered box, not the host's clientWidth. The
       host is `position: fixed; inset: 0`, whose clientWidth can come back
       narrower than the box the canvas actually paints into (classic
       scrollbar accounting), and sizing the backing store from it stretches
       the mesh horizontally by that difference. */
    const box = canvas.getBoundingClientRect();
    const cw = Math.max(1, Math.round((box.width || host.clientWidth) * dpr));
    const ch = Math.max(1, Math.round((box.height || host.clientHeight) * dpr));
    if (cw === w && ch === h) return;
    w = cw;
    h = ch;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);

    const scale = Math.max(w / MESH.W, h / MESH.H) * OVERSCAN;
    const ox = (w - MESH.W * scale) / 2;
    const oy = (h - MESH.H * scale) / 2;
    // clip = pos * uA + uB, with y flipped
    gl.uniform2f(u.uA, (2 * scale) / w, (-2 * scale) / h);
    gl.uniform2f(u.uB, (2 * ox) / w - 1, 1 - (2 * oy) / h);
  }

  const stopBuf = new Float32Array(3);
  function setStops(base) {
    const stops = rampStops(base);
    const loc = [u.uS0, u.uS1, u.uS2, u.uS3];
    for (let k = 0; k < 4; k++) {
      stopBuf[0] = stops[k].c[0] / 255;
      stopBuf[1] = stops[k].c[1] / 255;
      stopBuf[2] = stops[k].c[2] / 255;
      gl.uniform3fv(loc[k], stopBuf);
    }
  }

  /* ---- the loop ---- */
  let raf = 0;
  let running = false;
  let last = 0;
  let acc = 0;
  let clock = 0; // seconds of animation time, independent of wall clock gaps

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    const dt = last ? now - last : FRAME_MS;
    last = now;
    // a backgrounded or stalled tab must not fast forward the ocean on return
    acc += Math.min(dt, 250);
    if (acc < FRAME_MS) return;
    acc %= FRAME_MS;

    clock += FRAME_MS / 1000;

    /* No resize() here on purpose: reading host.clientWidth forces a layout
       flush, and doing that every frame would make a static background the
       most expensive thing on the page. Size is recomputed only on the
       debounced resize event. */
    setStops(cycleBase(clock / CYCLE_S));
    gl.uniform1f(u.uTime, clock);
    /* The ramp itself slides slowly across the page, so the light seems to
       move over the surface rather than the facets merely wobbling in place.
       Bounded to ±0.06: the deep end still clamps to the same stop, so this
       cannot darken the page past the contrast budget. */
    gl.uniform1f(u.uDrift, 0.06 * Math.sin(clock * 0.08));

    gl.drawArrays(gl.TRIANGLES, 0, n);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    acc = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // never burn a frame on a tab nobody is looking at
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  /* ResizeObserver, not a window resize listener. The canvas box changes for
     reasons the window never reports: the classic scrollbar appears once the
     perk field builds its DOM and the page grows past one screen, which
     narrows this fixed layer. A window listener misses that entirely and the
     backing store stays the wrong width for the whole session, stretching
     the mesh. Debounced so dragging a window edge cannot thrash buffer
     reallocation. */
  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  };
  let ro = null;
  if ('ResizeObserver' in window) {
    ro = new ResizeObserver(onResize);
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', onResize, { passive: true });
  }

  const onLost = (e) => {
    e.preventDefault();
    stop();
    canvas.classList.remove('is-live'); // reveal the static mesh again
  };
  canvas.addEventListener('webglcontextlost', onLost);

  resize();
  setStops(cycleBase(0));
  gl.uniform1f(u.uTime, 0);
  gl.uniform1f(u.uDrift, 0);
  gl.drawArrays(gl.TRIANGLES, 0, n); // paint frame zero before revealing
  canvas.classList.add('is-live');
  if (!document.hidden) start();

  return {
    stop,
    start,
    /* Exposed so the backing store can be re-fitted on demand. ResizeObserver
       delivers during the rendering steps, so it never fires in a document
       that is not compositing; this is also the only way to exercise the fit
       maths in a headless check. */
    resize,
    destroy() {
      stop();
      clearTimeout(resizeTimer);
      document.removeEventListener('visibilitychange', onVis);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.remove();
    },
  };
}
