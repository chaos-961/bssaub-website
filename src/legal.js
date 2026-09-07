// Entry for privacy.html, cookies.html and terms.html.
//
// page.js plus one stylesheet. No Lenis, no GSAP, no Matter, no preloader: a
// policy is read, not scrolled through, and every one of those costs a chunk
// on a page whose whole job is text. The mesh ground and the version badge are
// the only two things it shares with the rest of the site.
import '@fontsource-variable/roboto-condensed';
import '@fontsource-variable/instrument-sans';

import './styles/tokens.css';
import './styles/base.css';
import './styles/site-bg.css';
import './styles/legal.css';

import { initFooterVersion } from './modules/footerVersion.js';

initFooterVersion();

// Same reason as 404.html: these pages are linked with extensionless paths and
// have to point home at the configured base rather than at a relative "./".
document.querySelectorAll('[data-home-link]').forEach((a) => {
  a.href = import.meta.env.BASE_URL;
});
