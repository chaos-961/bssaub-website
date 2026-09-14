import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';

/* Build-time font preloads — the gated pages ONLY, by measurement (2026-07-22,
   local Lighthouse, 3-run medians): on index the §6.1 curtain already hides the
   font swap (its CLS 0.049 happens behind an opaque overlay), and preloading
   fonts there costs ~0.4s of LCP by contending with the JS the curtain release
   depends on. account.html and admin.html have no curtain, so their font swap
   is user visible and the preloads fix it for free. Filenames are resolved from
   the bundle (Vite hashes them); latin subsets only. Bubble images stay
   un-preloaded for the same contention reason.

   Recovered from the v0.4.0 tree at v0.4.2 with the account page (it had been
   removed at v0.4.1 when account.html was the only thing it served). */
const GATED_PAGES = new Set(['/account.html', '/admin.html']);

const preloadGatedAssets = () => ({
  name: 'bss-preload-gated-assets',
  transformIndexHtml: {
    order: 'post',
    handler(_html, ctx) {
      const tags = [];
      if (ctx.bundle && GATED_PAGES.has(ctx.path)) {
        for (const name of Object.keys(ctx.bundle)) {
          if (
            name.endsWith('.woff2') &&
            /(roboto-condensed-latin-wght|instrument-sans-latin-wght)/.test(name)
          ) {
            tags.push({
              tag: 'link',
              attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: name, crossorigin: true },
              injectTo: 'head',
            });
          }
        }
      }
      return tags;
    },
  },
});

/* Content Security Policy — BUILT OUTPUT ONLY, and only on the two pages that
   handle credentials. Injected here rather than written into the HTML because
   Vite's dev server serves an INLINE module script (the HMR client), so a
   `script-src 'self'` meta tag in the source file would break `npm run dev`
   while looking fine in production. `ctx.bundle` is present in build and absent
   in dev, which is the switch.

   GitHub Pages cannot set response headers, so this is a meta CSP, which means
   `frame-ancestors` is ignored by spec. Clickjacking is covered instead by the
   frame bust at the top of src/admin.js.

   script-src carries NO 'unsafe-inline' and NO 'unsafe-eval' — that is the part
   that actually buys anything. `blob:` on admin is what lets the decrypted
   dashboard module load (see src/admin.js); it cannot be an entry point for an
   attacker, since creating a blob URL already requires running script.

   style-src keeps 'unsafe-inline' on purpose: GSAP writes element styles, and
   the CSSOM/`style` attribute boundary is not worth a rewrite for a CSS-only
   injection surface when script execution is already locked down.

   The recaptcha origins are Firebase Auth's fallback path: identity toolkit can
   demand a reCAPTCHA challenge on password reset or sign-up when abuse
   protection kicks in, and without these the failure is a silent hang.

   firestore.googleapis.com joins both at v0.4.8, when the membership record
   arrived. The ADMIN page grew the whole Firebase set in the same pass and
   that is the bigger change: it used to talk to nothing but its own origin,
   because there was nothing behind the gate. It now signs in to a real admin
   account and writes member records, so it needs exactly what account.html
   needs. Note this is the one page where a missing origin here would look like
   a wrong password rather than a network error, since the sign in happens
   immediately after the unlock. */
const FIREBASE_CONNECT =
  'https://identitytoolkit.googleapis.com https://securetoken.googleapis.com ' +
  'https://firestore.googleapis.com';
const RECAPTCHA_SCRIPT = 'https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/';

const CSP_ACCOUNT = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'self'",
  `script-src 'self' ${RECAPTCHA_SCRIPT}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${FIREBASE_CONNECT}`,
  'frame-src https://bssaub.firebaseapp.com https://www.google.com',
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ');

const CSP_ADMIN = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'none'",
  `script-src 'self' blob: ${RECAPTCHA_SCRIPT}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${FIREBASE_CONNECT}`,
  'frame-src https://bssaub.firebaseapp.com https://www.google.com',
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ');

const contentSecurityPolicy = () => ({
  name: 'bss-csp',
  transformIndexHtml: {
    order: 'post',
    handler(_html, ctx) {
      if (!ctx.bundle) return [];
      const content =
        ctx.path === '/account.html' ? CSP_ACCOUNT : ctx.path === '/admin.html' ? CSP_ADMIN : null;
      if (!content) return [];
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content },
          injectTo: 'head-prepend',
        },
      ];
    },
  },
});

/* Clean URLs — internal links use extensionless paths ("account", not
   "account.html"). GitHub Pages resolves /account to account.html natively;
   this middleware gives the dev and preview servers the same behavior so links
   work identically in all three environments. Bare paths only (no trailing
   slash) to match what Pages actually serves. Index and 404 need no rewrite.

   Recovered from the v0.4.0 tree at v0.4.2. Since v0.6.2 CLEAN_PAGES is not
   typed out: it is every entry in INPUT except index and 404, so a new page
   registers once, in INPUT, and gets its dev rewrite and its 404.html slash
   redirect with no second list to forget.

   A slash variant (/bssaub-website/privacy/) is redirected to the bare path.
   Pages answers that URL with 404.html, whose first script does the same swap
   (see slashRedirect below); without this, dev and preview would fall through
   to Vite's SPA fallback and render index.html there instead. */
const BASE = '/bssaub-website/';
const html = (name) => fileURLToPath(new URL(`./${name}.html`, import.meta.url));
const INPUT = {
  index: html('index'),
  account: html('account'),
  admin: html('admin'),
  privacy: html('privacy'),
  cookies: html('cookies'),
  terms: html('terms'),
  notFound: html('404'),
};
const CLEAN_PAGES = Object.values(INPUT)
  .map((file) => basename(file, '.html'))
  .filter((name) => name !== 'index' && name !== '404');
const cleanUrls = () => {
  const rewrite = (req, res, next) => {
    const [path, query] = req.url.split('?');
    const search = query ? `?${query}` : '';
    for (const page of CLEAN_PAGES) {
      const clean = `${BASE}${page}`;
      if (path === clean) {
        req.url = `${clean}.html${search}`;
        break;
      }
      if (path.startsWith(`${clean}/`) && /^\/+$/.test(path.slice(clean.length))) {
        res.statusCode = 302;
        res.setHeader('Location', `${clean}${search}`);
        res.end();
        return;
      }
    }
    next();
  };
  return {
    name: 'bss-clean-urls',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
};

/* Trailing slash to clean URL, for the one host that cannot redirect: GitHub
   Pages serves 404.html for /bssaub-website/privacy/, so the swap happens in
   the first <script> of 404.html's head. That script needs the page names, and
   they are written in here from CLEAN_PAGES (so from INPUT) by replacing the
   %BSS_CLEAN_PAGES% token. The root it checks against is Vite's own
   %BASE_URL%, which follows `base` through the custom domain flip untouched.
   'pre' so the token is gone before Vite's env hook scans the page. The script
   carries no CSP of its own to satisfy: bss-csp above injects a policy on
   account and admin only, never on 404.html. */
const slashRedirect = () => ({
  name: 'bss-slash-redirect',
  transformIndexHtml: {
    order: 'pre',
    handler: (source) => source.replaceAll('%BSS_CLEAN_PAGES%', CLEAN_PAGES.join(',')),
  },
});

// base matches the GitHub Pages project path (CLAUDE.md §11).
// Custom domain later: flip base to '/' and add public/CNAME.
export default defineConfig({
  base: BASE,
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [preloadGatedAssets(), contentSecurityPolicy(), cleanUrls(), slashRedirect()],
  build: {
    rollupOptions: {
      input: INPUT,
    },
  },
});
