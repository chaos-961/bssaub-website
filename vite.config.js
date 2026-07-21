import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The supplied source images are intentionally kept in /assets. Preserve that
// public URL structure in production so static links stay identical to local dev.
export default defineConfig({
  plugins: [{
    name: 'copy-bss-assets',
    async writeBundle({ dir }) {
      await cp(resolve('assets'), resolve(dir, 'assets'), { recursive: true });
      await cp(resolve('main.js'), resolve(dir, 'main.js'));
      await cp(resolve('style.css'), resolve(dir, 'style.css'));
    }
  }]
});
