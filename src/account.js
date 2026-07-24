// Entry for account.html (§6.8): shared nav/footer around the placeholder,
// isolated so a future auth system slots in without touching index.
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/instrument-sans';

import './styles/tokens.css';
import './styles/base.css';
import './styles/site-bg.css';
import './styles/nav.css';
import './styles/stub.css';
import './styles/footer.css';

import { initScroll } from './modules/scroll.js';
import { initOceanMesh } from './modules/oceanMesh.js';
import { initNav } from './modules/nav.js';
import { initFooterVersion } from './modules/footerVersion.js';

const scroll = initScroll();
initOceanMesh();
initNav(scroll);
initFooterVersion();

document.querySelectorAll('[data-home-link]').forEach((a) => {
  a.href = import.meta.env.BASE_URL;
});
