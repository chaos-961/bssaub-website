import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

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
        account: fileURLToPath(new URL('./account.html', import.meta.url)),
        notFound: fileURLToPath(new URL('./404.html', import.meta.url)),
      },
    },
  },
});
