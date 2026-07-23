import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Build-time font preloads — account.html ONLY, by measurement (2026-07-22,
// local Lighthouse, 3-run medians): on index the §6.1 curtain already hides
// the font swap (its CLS 0.049 happens behind an opaque overlay), and
// preloading fonts there costs ~0.4s of LCP by contending with the JS the
// curtain release depends on. account.html has no curtain, so its font swap
// is user-visible — preloads fix it for free. Filenames resolved from the
// bundle (Vite hashes them); latin subsets only. Bubble images stay
// un-preloaded for the same contention reason.
const preloadGatedAssets = () => ({
  name: 'bss-preload-gated-assets',
  transformIndexHtml: {
    order: 'post',
    handler(_html, ctx) {
      const tags = [];
      if (ctx.bundle && ctx.path === '/account.html') {
        for (const name of Object.keys(ctx.bundle)) {
          if (
            name.endsWith('.woff2') &&
            /(fraunces-latin-full|instrument-sans-latin-wght)/.test(name)
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

// Clean URLs — internal links use extensionless paths ("account", not
// "account.html"). GitHub Pages resolves /account to account.html natively;
// this middleware gives the dev and preview servers the same behavior so
// links work identically in all three environments. Bare paths only (no
// trailing slash) to match what Pages actually serves.
const BASE = '/bssaub-website/';
const CLEAN_PAGES = ['account'];
const cleanUrls = () => {
  const rewrite = (req, _res, next) => {
    const [path, query] = req.url.split('?');
    for (const page of CLEAN_PAGES) {
      if (path === `${BASE}${page}`) {
        req.url = `${BASE}${page}.html${query ? `?${query}` : ''}`;
        break;
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

// base matches the GitHub Pages project path (CLAUDE.md §11).
// Custom domain later: flip base to '/' and add public/CNAME.
export default defineConfig({
  base: BASE,
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [preloadGatedAssets(), cleanUrls()],
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        account: fileURLToPath(new URL('./account.html', import.meta.url)),
        notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
      },
    },
  },
});
