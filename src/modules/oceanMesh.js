/* ------------------------------------------------------------------
   Ocean mesh (v0.3.2, user brief): the low poly background swells like a
   slow sea and its colour drifts through the rose family.
   v0.3.4 (user brief): make the swell and the colour drift MORE POWERFUL,
   and make both actually happen on a phone.

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
   Note that the v0.3.4 amplitude and palette changes cost exactly nothing:
   they are different numbers in the same uniforms, not more work per frame.

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
     - Fully parked when the tab is hidden.
     - prefers-reduced-motion never creates it at all.

   MOBILE (v0.3.4). Three things were between a phone and this animation, and
   only the first was ever a hard stop:
     1. CONTEXT LOSS WAS TERMINAL. Mobile GPUs drop WebGL contexts routinely
        when you leave the tab or the app; iOS is especially quick about it.
        The old handler stopped the loop and revealed the static mesh, and
        nothing ever brought it back, so a phone typically animated once and
        then looked permanently still. The context is now rebuilt on
        `webglcontextrestored`.
     2. A 30Hz DEVICE FELL TO 15Hz. Low Power Mode and battery savers cap rAF
        at 30fps, which lands a hair under this module's own 30fps gate once
        timer coarsening is applied, so every second frame was rejected. See
        FRAME_SLACK.
     3. THE MOTION WAS HALF SIZE IN PIXELS. `cover` renders the mesh at scale
        ~0.58 on a 375px viewport against ~1.03 on a desktop, so identical
        mesh unit motion arrived in barely half the pixels. Amplitude now
        compensates for the fit scale, capped (see AMP_SCALE_MAX).

   FALLBACK. The static mesh.svg stays as the CSS background underneath and
   is what paints before the bundle arrives, when JS is off, when motion is
   reduced, and when WebGL is unavailable or its context is gone. The canvas
   is built from the SAME lattice (src/lib/mesh.js), and the swell now eases
   up from zero, so the first painted frame is the static mesh exactly and
   the reveal is a true crossfade rather than a nudge.
   ------------------------------------------------------------------ */
import {
  MESH,
  AMP,
  AMP_SCALE_MAX,
  OVERSCAN,
  buildGeometry,
  gradientT,
  rampStops,
  cycleBase,
  swellGlsl,
} from '../lib/mesh.js';

const FPS = 30;
const FRAME_MS = 1000 / FPS;

/* Slack on the frame gate. A device whose own refresh is capped at 30Hz
   delivers frames a whisker under FRAME_MS apart once the browser's timer
   coarsening is applied; without this the gate rejects every one of them and
   the ocean runs at 15fps on exactly the hardware with the least to spare. */
const FRAME_SLACK = 2;

/* Seconds for one full trip around PALETTE_CYCLE. 96s over three stops was
   too slow to register as a change at all (user, v0.3.4); 64s over four
   stops is 16s a stop, still far below the rate at which motion pulls the
   eye, but now something you can actually notice happening. */
const CYCLE_S = 64;

/* The ramp itself slides across the page so the light appears to travel over
   the surface rather than the facets merely wobbling in place. Bounded: the
   ramp clamps at both ends, so sliding it can never push a facet past the
   deep stop the contrast gate is written against. */
const DRIFT_AMP = 0.15;
const DRIFT_SPEED = 0.13;

/* Seconds for the swell to rise from flat to full. At clock 0 displacement is
   zero, which makes frame zero pixel identical to the static mesh underneath,
   so the 0.7s opacity crossfade has nothing to reveal but colour. Also re-run
   after a context restore. */
const WAKE_S = 1.6;

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

/* GENERATED from SWELL in src/lib/mesh.js — do not hand edit this function
   here. It is emitted from the same table that scripts/check-swell.mjs runs
   the inversion proof against, so the thing that ships and the thing that was
   verified cannot drift apart. Phase comes from the vertex's own position, so
   neighbours move together and it reads as one surface. */
${swellGlsl()}

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

const smoothstep = (t) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

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

  /* ---- CPU side vertex data, built once and kept ----
     Held outside the GPU state on purpose: a context restore has to re-upload
     these, and regenerating them there would mean rebuilding the whole
     lattice on a phone that is already busy coming back to life. */
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

  /* ---- GPU state. Everything here dies with the context and is rebuilt by
     buildGpu(), which is why it is one function and not inline setup. ---- */
  let program = null;
  let u = null;
  let ready = false;

  function buildGpu() {
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
      program = null;
      return false;
    }

    gl.useProgram(program);

    // buffers, uploaded once per context and never touched again
    const mkBuf = (data, size, name) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    mkBuf(pos, 2, 'aPos');
    mkBuf(ramp, 1, 'aRamp');
    mkBuf(sca, 1, 'aScatter');

    u = {};
    for (const name of ['uA', 'uB', 'uTime', 'uAmp', 'uDrift', 'uS0', 'uS1', 'uS2', 'uS3']) {
      u[name] = gl.getUniformLocation(program, name);
    }
    ready = true;
    return true;
  }

  /* ---- viewport fit: `cover` plus overscan, mesh space to clip space ---- */
  let w = 0;
  let h = 0;
  let ampScale = 1;

  function resize() {
    if (!ready) return;
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

    /* `fit` is the plain cover scale, before overscan: mesh units to CSS
       pixels. A phone sits near 0.58 and a desktop near 1.03, which is the
       whole reason the same swell used to feel like half the movement on a
       phone. Amplitude buys that back, but only up to AMP_SCALE_MAX, because
       the no-inversion proof is written in MESH units and this is the number
       that inflates them. */
    const fit = Math.max(w / MESH.W, h / MESH.H);
    ampScale = Math.min(AMP_SCALE_MAX, Math.max(1, 1 / fit));

    const scale = fit * OVERSCAN;
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

  /* The canvas must be in the DOM before resize() runs: getBoundingClientRect
     on a detached element is all zeros, which would silently drop us onto the
     host.clientWidth fallback the comment above warns about. */
  host.appendChild(canvas);
  if (!buildGpu()) {
    canvas.remove(); // static mesh.svg stays, which is a complete background
    return null;
  }

  /* ---- the loop ---- */
  let raf = 0;
  let running = false;
  let last = 0;
  let acc = 0;
  let clock = 0; // seconds of animation time, independent of wall clock gaps
  let wakeFrom = 0; // clock value the swell last started rising from

  function draw() {
    /* No resize() here on purpose: reading the canvas box forces a layout
       flush, and doing that every frame would make a static background the
       most expensive thing on the page. Size is recomputed only on the
       debounced ResizeObserver. */
    setStops(cycleBase(clock / CYCLE_S));
    gl.uniform1f(u.uTime, clock);
    gl.uniform1f(u.uAmp, AMP * ampScale * smoothstep((clock - wakeFrom) / WAKE_S));
    gl.uniform1f(u.uDrift, DRIFT_AMP * Math.sin(clock * DRIFT_SPEED));
    gl.drawArrays(gl.TRIANGLES, 0, n);
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    const dt = last ? now - last : FRAME_MS;
    last = now;
    // a backgrounded or stalled tab must not fast forward the ocean on return
    acc += Math.min(dt, 250);
    if (acc < FRAME_MS - FRAME_SLACK) return;
    acc = 0;

    clock += FRAME_MS / 1000;
    draw();
  }

  function start() {
    if (running || !ready) return;
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

  /* Context loss is ROUTINE on mobile, not an error path: leave the tab, take
     a call, let the GPU reclaim memory, and it goes. preventDefault is what
     makes the browser promise a `webglcontextrestored` afterwards. Until then
     the static mesh is showing and is a complete background. */
  const onLost = (e) => {
    e.preventDefault();
    stop();
    ready = false;
    program = null;
    canvas.classList.remove('is-live'); // reveal the static mesh again
  };
  const onRestored = () => {
    if (!buildGpu()) return; // static mesh keeps the page; nothing is broken
    w = 0;
    h = 0;
    resize();
    // ease the swell up from flat again so the crossfade back has no jump
    wakeFrom = clock;
    draw();
    canvas.classList.add('is-live');
    if (!document.hidden) start();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  resize();
  draw(); // clock is 0, so this frame IS the static mesh: paint before revealing
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
      canvas.removeEventListener('webglcontextrestored', onRestored);
      canvas.remove();
    },
  };
}
