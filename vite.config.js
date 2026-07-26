import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/* Two plugins lived here until v0.4.1 and were removed with the account
   system, because account.html was the only thing either one served:

   - bss-preload-gated-assets injected font preloads into account.html ONLY,
     by measurement (2026-07-22, local Lighthouse, 3-run medians). Index was
     deliberately excluded: the §6.1 curtain already hides its font swap (CLS
     0.049, behind an opaque overlay) and preloading there cost ~0.4s of LCP
     by contending with the JS the curtain release depends on. account.html
     had no curtain, so its swap was user visible and the preloads were free.
     That reasoning still holds for index, which is why nothing replaced it.
   - bss-clean-urls rewrote extensionless paths (/account → account.html) in
     dev and preview so links behaved the way GitHub Pages serves them. Its
     page list held exactly one entry, and index and 404 need no rewrite.

   Recover either from the v0.4.0 tree when a second page lands. A new page
   that wants an extensionless link needs the clean URL middleware back, or
   it will 404 in dev while working fine on Pages. */

// base matches the GitHub Pages project path (CLAUDE.md §11).
// Custom domain later: flip base to '/' and add public/CNAME.
export default defineConfig({
  base: '/bssaub-website/',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
      },
    },
  },
});
