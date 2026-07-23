// Aurora sky — the WebGL ray-line layer (2026-07-24 final brief, after a
// same-day night-sky detour: "white background and on top simple colors
// and like these lines and some stars"). A fragment shader paints tall
// striated ray curtains over the warm white ground in the site family:
// dusty rose, brand maroon, mauve, a lilac guest, and the champagne
// glow — the reference photo's structure, the site's palette.
// Progressive enhancement: the canvas fades in at z 1 over the CSS
// bands and under the star-speck layer (z 2), so the specks ride both
// modes. No WebGL, no JS, or a lost context means the CSS bands carry
// the look. 404 stays CSS-only to protect its ~1KB JS identity.
//
// Performance contract:
// - Renders at half CSS resolution (soft gradients upscale invisibly),
//   dimension-capped for 4K, an extra 0.8 factor on small screens,
//   low-power context, one draw call per frame, ~30fps gate, paused
//   whenever the tab is hidden.
// - Color mixes are capped (rose .40, maroon .16, mauve .26, lilac .20,
//   champagne .30) so the darkest pixel the sky can produce keeps every
//   text token at WCAG AA on the ground; the night-contrast.mjs port
//   (light mode) re-verifies worst-case frames without a GPU.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    v += amp * noise(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return v;
}

// one curtain: gaussian band around a wandering baseline, textured by
// noise rays (stretched vertically) times a sine striation — the tall
// thin ray LINES of the reference photo
float curtain(vec2 uv, float cy, float th, float rf, float sf, float sp, float seed) {
  float wander = fbm(vec2(uv.x * 1.2 + seed, uTime * 0.014 + seed * 3.0));
  float y = uv.y - cy - (wander - 0.5) * 0.3 - sin(uv.x * 1.9 + seed * 7.0) * 0.05;
  float band = exp(-y * y / (th * th));
  float rays = fbm(vec2(uv.x * rf + uTime * sp + seed * 31.0, uv.y * 1.4 - uTime * 0.010));
  rays = smoothstep(0.30, 0.85, rays);
  float stri = 0.5 + 0.5 * sin(uv.x * sf + (wander - 0.5) * 9.0 + seed * 13.0);
  stri = 0.35 + 0.65 * stri * stri;
  return band * (0.30 + 0.70 * rays) * stri;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv + uPointer * 0.025;
  vec2 q = vec2(p.x * (uRes.x / uRes.y), p.y);
  // slight diagonal lean, matching the CSS band rotations
  float cs = cos(-0.14);
  float sn = sin(-0.14);
  vec2 d = vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);

  float breathe = 0.92 + 0.08 * sin(uTime * 0.05);
  float rose = curtain(d, 0.68, 0.16, 2.4, 30.0, 0.012, 1.7) * breathe;
  float deep = curtain(d, 0.50, 0.09, 3.6, 40.0, -0.014, 9.2);
  float mauve = curtain(d, 0.24, 0.18, 1.9, 20.0, 0.008, 4.4) * breathe;
  float lilac = curtain(d, 0.42, 0.13, 2.1, 26.0, -0.010, 6.1);
  vec2 g = uv - vec2(0.62, 0.38);
  float glow = exp(-dot(g, g) * 2.8);

  // mixes over the cream ground, each capped for the readability floor
  vec3 col = vec3(0.988, 0.980, 0.973);
  col = mix(col, vec3(0.910, 0.776, 0.667), glow * 0.30);
  col = mix(col, vec3(0.588, 0.431, 0.529), min(mauve * 0.26, 0.26));
  col = mix(col, vec3(0.604, 0.463, 0.753), min(lilac * 0.20, 0.20));
  col = mix(col, vec3(0.745, 0.392, 0.510), min(rose * 0.40, 0.40));
  col = mix(col, vec3(0.533, 0.082, 0.196), min(deep * 0.16, 0.16));
  gl_FragColor = vec4(col, 1.0);
}
`;

function reducedMotion() {
  return (
    document.documentElement.classList.contains('reduced-motion') ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function initAuroraSky() {
  const host = document.querySelector('.site-bg');
  if (!host || !window.WebGLRenderingContext) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'site-bg__canvas';
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) return;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  const uPointer = gl.getUniformLocation(prog, 'uPointer');

  host.appendChild(canvas);

  const size = () => {
    // half CSS resolution, capped; phones drop a further 20% — the sky
    // is soft gradients, the upscale is invisible and the GPU is spared
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const small = Math.min(innerWidth, innerHeight) < 700 ? 0.8 : 1;
    const k = dpr * 0.5 * small;
    const w = Math.min(1600, Math.round(innerWidth * k));
    const h = Math.min(1000, Math.round(innerHeight * k));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let raf = 0;
  let last = 0;
  const START = 40; // seed offset so the first frame is mid-flow, not t=0

  const draw = (t) => {
    size();
    pointer.x += (pointer.tx - pointer.x) * 0.03;
    pointer.y += (pointer.ty - pointer.y) * 0.03;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, START + ((t / 1000) % 3600)); // bounded for mediump GPUs
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.classList.add('is-on');
  };

  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (t - last < 33) return; // ~30fps is plenty for slow sky
    last = t;
    draw(t);
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const start = () => {
    if (!raf && !reducedMotion()) raf = requestAnimationFrame(loop);
  };

  if (reducedMotion()) {
    draw(0); // one finished frame, then stillness
    host.dataset.aurora = 'static';
  } else {
    start();
    host.dataset.aurora = 'flowing';
    addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stop();
    canvas.remove(); // CSS bands take over
    host.dataset.aurora = 'css';
  });

  return { stop };
}
