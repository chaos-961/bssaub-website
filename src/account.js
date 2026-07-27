/* Entry for account.html (v0.4.2). The shared nav, background and footer
   around the auth card; Firebase itself is pulled in lazily from
   accountAuth.js so the shell and the ocean start without waiting for it. */
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/instrument-sans';

import './styles/tokens.css';
import './styles/base.css';
import './styles/site-bg.css';
import './styles/nav.css';
import './styles/auth.css';
import './styles/footer.css';

import { initScroll } from './modules/scroll.js';
import { initOceanMesh } from './modules/oceanMesh.js';
import { initNav } from './modules/nav.js';
import { initFooterVersion } from './modules/footerVersion.js';
import { initAccount } from './modules/accountAuth.js';

/* The js / reduced-motion root classes are set HERE rather than in an inline
   <script> in the page head: the built CSP on this page is script-src 'self'
   with no 'unsafe-inline' (see vite.config.js), and nothing on this page reads
   either class before this line. Index keeps its inline version, because there
   the class gates the preloader curtain, which has to be up before the bundle
   arrives. Both must land before the init calls below, which read the reduced
   motion state to decide whether to build anything at all. */
document.documentElement.classList.add('js');
if (new URLSearchParams(location.search).has('reduced-motion')) {
  document.documentElement.classList.add('reduced-motion');
}

const scroll = initScroll();
initOceanMesh(scroll);
initNav(scroll);
initFooterVersion();
initAccount();

document.querySelectorAll('[data-home-link]').forEach((a) => {
  a.href = import.meta.env.BASE_URL;
});
