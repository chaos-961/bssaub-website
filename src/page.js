// Light entry for the stub pages (account.html, 404.html).
// No Lenis/GSAP here — these pages stay tiny (§6.8, §6.9).
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/instrument-sans';

import './styles/tokens.css';
import './styles/base.css';
import './styles/site-bg.css';
import './styles/stub.css';

import { initFooterVersion } from './modules/footerVersion.js';

initFooterVersion();

// 404.html is served at arbitrary paths on GitHub Pages, so "home" must be
// the configured base, not a relative link.
document.querySelectorAll('[data-home-link]').forEach((a) => {
  a.href = import.meta.env.BASE_URL;
});
