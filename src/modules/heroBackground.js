// Hero background — volumetric caustic light in a single fullscreen fragment
// shader (one draw call, no post passes). Soft maroon ribbons of light drift
// across a near-black field; a few focal nodes bloom to white where the ribbons
// cross, biased right-of-center so the brightness pools behind the card and
// never washes out the headline or the maroon CTA on the left. Faint white
// specks keep the star motif the standalone starfield used to carry (that
// full-page canvas was extracted to a template at v0.2.5; this is hero-only).
//
// Ribbons: 5 domain-warped FBM fields, each with its own scale, drift direction
// and slow speed (0.030..0.075). The caustic feel comes from a ridged fold
// (1 - |2n - 1|) sharpened with pow() into thin lines; bloom is faked in-shader
// by pairing a tight core power with a wide soft halo (two radii, additive). A
// very slow secondary warp drifts the whole composition so it never visibly
// loops, and a per-load hash seed means no two loads look the same.
//
// Perf: DPR capped at 1.5, rendered at 0.75x internal resolution and upscaled,
// locked to ~30fps via a delta accumulator, paused off-screen (Intersection-
// Observer) and while the tab is hidden. prefers-reduced-motion (and the site's
// ?reduced-motion hook) paint a single static frame. Self-contained:
// initHeroBackground(canvasEl) returns { destroy }.

const VERT_GL2 = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const VERT_GL1 = `attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Fragment body shared by both GL versions; a version-specific header prepended
// in build() supplies precision + the fragColor output binding.
const FRAG_BODY = `
uniform vec2 uResolution;
uniform float uTime;
uniform float uSeed;

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float vnoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

const mat2 ROT = mat2(1.62, 1.18, -1.18, 1.62);

// cheap 2-octave fbm — enough detail for the warp / drift fields
float fbm2(vec2 p){
  float v = 0.5 * vnoise(p);
  p = ROT * p;
  v += 0.25 * vnoise(p);
  return v / 0.75;
}

// 4-octave fbm for the ribbon body
float fbm(vec2 p){
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++){
    v += amp * vnoise(p);
    p = ROT * p;
    amp *= 0.5;
  }
  return v;
}

// one caustic ribbon field. returns vec2(core, halo): a thin sharpened crest
// line plus a wide soft glow around the same crest (faked bloom, two radii).
// The ribbons are iso-contours of a domain-warped noise field: bright where the
// band folds to zero, dark between, so the field stays near-black in the gaps.
vec2 ribbon(vec2 p, float scale, vec2 dir, float speed, float phase, float sharp, float freq){
  float t = uTime * speed;
  vec2 lp = p * scale + dir * t + phase;
  vec2 w = vec2(fbm2(lp + vec2(0.0, t)),
                fbm2(lp + vec2(4.7, -t) + 1.3));
  vec2 r = lp + 1.15 * (w - 0.5);
  float edge = 1.0 - abs(sin(fbm(r * 1.05) * freq + t * 0.6));
  return vec2(pow(edge, sharp), pow(edge, sharp * 0.30));
}

// slow-moving radial falloff, biased right-of-center, that the hot white cores
// are gated by so the brightness pools into a few nodes behind the card.
float focusField(vec2 uv, float t){
  vec2 a = uv - vec2(0.72 + 0.05 * sin(t * 0.050 + uSeed * 3.1), 0.44 + 0.07 * sin(t * 0.037));
  vec2 b = uv - vec2(0.60 + 0.05 * sin(t * 0.043 + 1.7), 0.63 + 0.06 * sin(t * 0.031 + uSeed));
  vec2 c = uv - vec2(0.86 + 0.04 * sin(t * 0.029 + 4.0), 0.52 + 0.05 * sin(t * 0.050 + 2.2));
  float f = smoothstep(0.42, 0.0, length(a * vec2(1.0, 1.25)));
  f += 0.85 * smoothstep(0.38, 0.0, length(b * vec2(1.0, 1.25)));
  f += 0.70 * smoothstep(0.34, 0.0, length(c * vec2(1.0, 1.25)));
  return f;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;

  // per-load offset so no two loads match
  vec2 sOff = vec2(hash21(vec2(uSeed, 1.0)), hash21(vec2(uSeed, 7.0))) * 40.0;
  vec2 p = vec2(uv.x * aspect, uv.y) + sOff;

  // very slow secondary warp of the whole field — drifts, never loops
  vec2 drift = vec2(fbm2(p * 0.35 + uTime * 0.012),
                    fbm2(p * 0.35 + 9.0 - uTime * 0.010));
  p += 0.20 * (drift - 0.5);

  float ph = uSeed * 6.2831;
  vec2 R = vec2(0.0);
  R += 1.00 * ribbon(p, 1.05, vec2( 0.42,  0.12), 0.030, ph * 1.00,  7.0,  8.0);
  R += 0.85 * ribbon(p, 1.65, vec2(-0.30,  0.28), 0.046, ph * 1.63,  8.0, 10.0);
  R += 0.70 * ribbon(p, 2.35, vec2( 0.18, -0.34), 0.038, ph * 2.20,  9.0, 12.0);
  R += 0.55 * ribbon(p, 3.30, vec2(-0.36, -0.16), 0.062, ph * 2.91, 10.0, 15.0);
  R += 0.45 * ribbon(p, 4.55, vec2( 0.24,  0.30), 0.075, ph * 3.42, 11.0, 18.0);
  float core = R.x; // additive: ~0 in the gaps, stacks where ribbons cross
  float halo = R.y;

  float focus = clamp(focusField(uv, uTime), 0.0, 1.6);

  // palette (sRGB 0..1) — AUB / BSS maroon on near-black
  vec3 base0  = vec3(0.051, 0.047, 0.059); // #0D0C0F
  vec3 base1  = vec3(0.110, 0.106, 0.122); // #1C1B1F
  vec3 rDesat = vec3(0.290, 0.227, 0.259); // #4A3A42
  vec3 rMar0  = vec3(0.545, 0.122, 0.208); // #8B1F35
  vec3 rMar1  = vec3(0.690, 0.165, 0.271); // #B02A45
  vec3 hotFall= vec3(0.910, 0.835, 0.855); // #E8D5DA
  vec3 hotCore= vec3(1.000, 1.000, 1.000); // #FFFFFF

  // near-black ground with a subtle large-scale drift between the two blacks
  float bgN = fbm(p * 0.6 + 3.0);
  vec3 col = mix(base0, base1, smoothstep(0.35, 0.75, bgN));

  // soft, blurred maroon ribbons come from the wide halo — low contrast, no
  // hard edges, the way caustic light pools; most of the field stays in the
  // muted maroon and only the densest glow lifts to full brand maroon
  vec3 ribbonCol = mix(rDesat, rMar0, smoothstep(0.35, 1.35, halo));
  ribbonCol = mix(ribbonCol, rMar1, smoothstep(1.5, 2.6, halo));
  col = mix(col, ribbonCol, smoothstep(0.42, 2.0, halo) * 0.62);

  // a little brighter maroon along the thin crest centres for definition
  col += rMar1 * smoothstep(0.40, 1.2, core) * 0.15;

  // focal hot cores -> white, only where strong crossings sit inside a focus
  // node (right-biased); kept to a few so it reads as pooling, not sparkle
  float hot = clamp(smoothstep(1.05, 2.0, core) * focus, 0.0, 1.0);
  vec3 hotCol = mix(hotFall, hotCore, smoothstep(0.5, 1.0, hot));
  col = mix(col, hotCol, hot * 0.9);
  col += hotFall * pow(hot, 2.0) * 0.32;

  // faint white specks — the star motif, kept to the darker regions
  vec2 sg = vec2(uv.x * aspect, uv.y) * 210.0 + sOff * 3.0;
  vec2 gi = floor(sg);
  float sh = hash21(gi + 11.0);
  float present = step(0.9973, sh);
  vec2 gf = fract(sg) - 0.5;
  float twinkle = 0.65 + 0.35 * sin(uTime * 0.7 + sh * 63.0);
  float speck = present * smoothstep(0.30, 0.0, length(gf)) * twinkle;
  speck *= (1.0 - smoothstep(0.15, 0.9, core)); // keep specks to the darker gaps
  col += vec3(1.0) * speck * 0.30;

  // gentle vignette to keep the edges calm
  float vig = smoothstep(1.20, 0.35, length(vec2((uv.x - 0.5) * aspect, uv.y - 0.5)));
  col *= mix(0.82, 1.0, vig);

  col = max(col, 0.0);

  // fade the near-black bottom into the page --bg (gl_FragCoord.y = 0 is bottom)
  float alpha = smoothstep(0.0, 0.12, uv.y);

  fragColor = vec4(col, alpha);
}`;

export function initHeroBackground(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return { destroy() {} };

  const dev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
  const reduced =
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    document.documentElement.classList.contains('reduced-motion');

  const attribs = {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power',
  };

  let gl = canvas.getContext('webgl2', attribs);
  let isGL2 = !!gl;
  if (!gl) gl = canvas.getContext('webgl', attribs) || canvas.getContext('experimental-webgl', attribs);
  if (!gl) return { destroy() {} }; // no WebGL — canvas stays transparent, page ground shows

  const DPR_CAP = 1.5;
  const INTERNAL = 0.75;
  const FRAME_MS = 1000 / 30;
  const seed = Math.random() * 997.0;

  let program = null;
  let buffer = null;
  let vao = null;
  let uRes = null;
  let uTime = null;
  let uSeed = null;
  let aPos = -1;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      if (dev) console.warn('[heroBg] shader compile:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function build() {
    const vertSrc = isGL2 ? VERT_GL2 : VERT_GL1;
    const fragSrc = isGL2
      ? `#version 300 es\nprecision highp float;\nout vec4 fragColor;\n${FRAG_BODY}`
      : `precision highp float;\n#define fragColor gl_FragColor\n${FRAG_BODY}`;

    const vs = compile(gl.VERTEX_SHADER, vertSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return false;

    program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      if (dev) console.warn('[heroBg] program link:', gl.getProgramInfoLog(program));
      return false;
    }

    uRes = gl.getUniformLocation(program, 'uResolution');
    uTime = gl.getUniformLocation(program, 'uTime');
    uSeed = gl.getUniformLocation(program, 'uSeed');
    aPos = gl.getAttribLocation(program, 'aPos');

    // fullscreen triangle
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    if (isGL2) {
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    }

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    return true;
  }

  let ok = build();

  let vw = 0;
  let vh = 0;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const w = Math.max(1, Math.round(rect.width * dpr * INTERNAL));
    const h = Math.max(1, Math.round(rect.height * dpr * INTERNAL));
    if (w === vw && h === vh) return true;
    vw = w;
    vh = h;
    canvas.width = w;
    canvas.height = h;
    return true;
  }

  function render(elapsed) {
    if (!ok || !program) return;
    if (!vw || !vh) {
      if (!resize()) return;
    }
    gl.viewport(0, 0, vw, vh);
    gl.useProgram(program);
    if (isGL2) {
      gl.bindVertexArray(vao);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    }
    gl.uniform2f(uRes, vw, vh);
    gl.uniform1f(uTime, elapsed);
    gl.uniform1f(uSeed, seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (isGL2) gl.bindVertexArray(null);
  }

  // pacing
  let rafId = 0;
  let running = false;
  let onScreen = true;
  let visible = !document.hidden;
  let last = 0;
  let acc = 0;
  let elapsed = seed * 0.13; // stagger the starting phase per load

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    if (!last) last = now;
    let dt = now - last;
    last = now;
    if (dt < 0) dt = 0;
    if (dt > 100) dt = FRAME_MS; // came back from a throttle — one step, no jump
    acc += dt;
    if (acc < FRAME_MS) return; // frame-skip to ~30fps
    elapsed += acc / 1000;
    acc = 0;
    render(elapsed);
  }

  function play() {
    if (running || !ok || reduced || !onScreen || !visible) return;
    running = true;
    last = 0;
    rafId = requestAnimationFrame(loop);
  }

  function pause() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function paintOnce() {
    if (!ok) return;
    resize();
    render(elapsed);
  }

  const target = canvas.closest('[data-hero-bg]') || canvas;

  const io =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            onScreen = entries.some((e) => e.isIntersecting);
            if (reduced) return;
            if (onScreen && visible) play();
            else pause();
          },
          { threshold: 0 },
        )
      : null;
  if (io) io.observe(target);

  const onVisibility = () => {
    visible = !document.hidden;
    if (reduced) return;
    if (visible && onScreen) play();
    else pause();
  };
  document.addEventListener('visibilitychange', onVisibility);

  let resizeRaf = 0;
  const onResize = () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      const changed = resize();
      if (changed && !running) render(elapsed); // repaint while paused / reduced
    });
  };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(onResize) : null;
  if (ro) ro.observe(target);
  else window.addEventListener('resize', onResize);

  const onLost = (e) => {
    e.preventDefault();
    pause();
  };
  const onRestored = () => {
    isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    vw = 0;
    vh = 0;
    ok = build();
    paintOnce();
    if (!reduced) play();
  };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  // kick off
  resize();
  if (reduced) paintOnce();
  else play();

  return {
    destroy() {
      pause();
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (gl) {
        if (buffer) gl.deleteBuffer(buffer);
        if (vao && isGL2) gl.deleteVertexArray(vao);
        if (program) gl.deleteProgram(program);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
      program = buffer = vao = null;
    },
  };
}
