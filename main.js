const localFile = location.protocol === 'file:';
const staticHost = localFile || location.hostname.endsWith('.github.io');
const asset = (name) => new URL(`assets/${name}`, document.baseURI).href;
const sponsor = (name) => asset(`Sponsored/${name}.png`);
let stopMotion = () => {};

const categories = {
  restaurants: {
    label: 'RESTAURANTS',
    items: [
      ['baguettebistrolb', '20', 'Baguette Bistro'], ['kibbekitchen', '10', 'Kibbe Kitchen'],
      ['sushi_bell', '15', 'Sushi Bell'], ['cravesburger', '10', 'Craves Burger'],
      ['fattouhrestaurant', '20', 'Fattouh Restaurant'], ['salonbeyrouth', '15', 'Salon Beyrouth'],
      ['muncheasediner', '20', 'Munchease Diner'], ['joyofbeirut', '10', 'Joy of Beirut'],
      ['allobeirut.lb', '10', 'Allo Beirut'], ['cravylb', '10', 'Cravy'],
      ['smash.it.1', '15', 'Smash It'], ['papasmiatacos', '30', 'Papas Mia Tacos'],
      ['dunkinleb', '10', "Dunkin'", '/dunkin'], ['mcdonaldsleb', '20', "McDonald's", '/mcdonalds']
    ]
  },
  clothing: { label: 'CLOTHING', items: [['leaders.fit', '25', 'Leaders Fit'], ['belinda.atelier', '15', 'Belinda Atelier'], ['popjammies', '10', 'Pop Jammies']] },
  'health-and-beauty': { label: 'HEALTH / BEAUTY', items: [['pure28clinic', '15', 'Pure28 Clinic'], ['pure28beauty', '15', 'Pure28 Beauty'], ['dentspa_drrabah', '15', 'Dentspa'], ['optiqueetvision', '25', 'Optique et Vision']] },
  fitness: { label: 'FITNESS', items: [['padel.loft', '25', 'Padel Loft'], ['padelsquare.lb', '20', 'Padel Square'], ['thekalmstudio', '20', 'The Kalm Studio']] },
  services: { label: 'SERVICES', items: [['simplea_tutoring', '20', 'Simple A Tutoring']] }
};

const links = [
  ['restaurants', 'Restaurants'], ['clothing', 'Clothing'], ['health-and-beauty', 'Health & Beauty'], ['fitness', 'Fitness'], ['services', 'Services']
];

function routeHref(path) { return staticHost ? `#${path}` : path; }
function currentRoute() { return staticHost ? (location.hash.startsWith('#/') ? location.hash.slice(1) : '/') : location.pathname; }
function navigate(path) { if (staticHost) location.hash = path; else { history.pushState({}, '', path); render(); } window.scrollTo({ top: 0, behavior: 'instant' }); }
function logo() { return `<a class="brand" href="${routeHref('/')}" data-route aria-label="BSS home"><img src="${asset('logo.png')}" alt="Business Student Society" /></a>`; }
function header() {
  return `<header class="site-header"><div class="nav-shell">
    ${logo()}<button class="menu-button" aria-label="Open menu" aria-expanded="false"><i></i><i></i><i></i></button>
    <nav class="nav" aria-label="Primary navigation"><a href="${routeHref('/')}" data-route>HOME</a><div class="sponsor-menu"><button aria-expanded="false">SPONSORS <span>+</span></button><div class="dropdown">${links.map(([p, t]) => `<a href="${routeHref(`/${p}`)}" data-route>${t}</a>`).join('')}</div></div><a href="${routeHref('/about-us')}" data-route>ABOUT US</a><a href="${routeHref('/sponsor-us')}" data-route>SPONSOR US</a></nav>
  </div></header>`;
}
function footer() { return `<footer><div class="footer-main"><img src="${asset('logo.png')}" alt="Business Student Society" /><div><p class="eyebrow">BUSINESS STUDENT SOCIETY</p><p class="footer-copy">Connecting the next generation of business leaders at the American University of Beirut.</p></div><div class="footer-links"><p class="eyebrow">KEEP IN TOUCH</p><a href="https://instagram.com/businessstudentsociety" target="_blank" rel="noreferrer">Instagram ↗</a><a href="mailto:aubbusinesssociety@gmail.com">aubbusinesssociety@gmail.com</a></div></div><div class="copyright">© ${new Date().getFullYear()} BUSINESS STUDENT SOCIETY · AUB</div></footer>`; }
function card([image, discount, name, detail]) {
  const url = detail || `https://instagram.com/${image}`;
  const body = `<div class="card-image"><img src="${sponsor(image)}" alt="${name}" loading="lazy" /></div><div class="card-caption"><span>${name}</span><span class="discount">${discount}% OFF</span></div><div class="card-action">${detail ? 'LEARN MORE →' : 'VIEW ON INSTAGRAM ↗'}</div>`;
  return `<a href="${url}" ${detail ? 'data-route' : 'target="_blank" rel="noreferrer"'} class="sponsor-card">${body}</a>`;
}
function categoryBlock(key, full = false) { const cat = categories[key]; return `<section class="category reveal" id="${key}"><div class="category-heading"><p class="eyebrow">${full ? 'CATEGORY' : 'BSS MEMBER BENEFITS'}</p><h2>${cat.label}<em>:</em></h2></div><div class="sponsor-grid">${cat.items.map(card).join('')}</div></section>`; }
function home() { return `<main>
  <section class="hero"><div class="hero-image" aria-hidden="true"></div><div class="hero-grid" aria-hidden="true"></div><div class="hero-content"><p class="eyebrow">AMERICAN UNIVERSITY OF BEIRUT · OSB</p><h1>MORE THAN<br><i>A BUSINESS</i><br>SOCIETY.</h1><p class="hero-copy">A student community built around connection, experience and opportunities that last beyond campus.</p><div class="hero-actions"><a class="button button-light" href="${routeHref('/about-us')}" data-route>LEARN MORE</a><a class="button" href="https://forms.cloud.microsoft/r/d5fFFxbKKN" target="_blank" rel="noreferrer">GET THE MEMBERSHIP CARD</a></div></div><div class="hero-side-note">BSS · AUB<br><span>EST. 2020</span></div><a class="scroll-note" href="#sponsors">SCROLL TO EXPLORE <span>↓</span></a></section>
  <section class="sponsors-intro reveal" id="sponsors"><p class="eyebrow">EXCLUSIVE BSS CARD BENEFITS</p><h2>OUR <i>SPONSORS</i></h2><p>Member benefits from places our community already loves.</p><div class="jump-links">${links.map(([p,t]) => `<a href="#${p}">${t}<span>↘</span></a>`).join('')}</div></section>
  <div class="categories">${Object.keys(categories).map(k => categoryBlock(k)).join('')}</div>
  <section class="cta-section reveal"><p class="eyebrow">MORE TO COME</p><h2>STAY TUNED FOR<br><i>FUTURE DISCOUNTS!</i></h2><a class="button" href="https://docs.google.com/forms/d/e/1FAIpQLSfNuDMnuJWkrMCicyDkYd9bCPNlkw7XeeqLfNpXhAMrXeT8Ow/viewform" target="_blank" rel="noreferrer">SPONSOR US</a></section>
  <section class="business-cta reveal"><div><p class="eyebrow">PARTNER WITH BSS</p><h2>HAVE YOUR OWN BUSINESS?<br><i>BECOME A SPONSOR.</i></h2></div><a href="${routeHref('/sponsor-us')}" data-route class="arrow-link" aria-label="Become a sponsor">VIEW PARTNERSHIPS <span>↗</span></a></section>
</main>`; }
function categoryPage(key) { return `<main class="inner-page"><section class="page-hero"><p class="eyebrow">BSS AUB / SPONSORS</p><h1>${categories[key].label}</h1><p>Exclusive benefits for Business Student Society members.</p></section>${categoryBlock(key, true)}</main>`; }
function about() { return `<main class="about-page"><section class="about-hero"><div class="reveal"><p class="eyebrow">BUSINESS STUDENT SOCIETY · AUB</p><h1>WE CREATE<br><i>CONNECTIONS.</i></h1><p>At BSS, we make the OSB experience more rewarding through a lively campus community, practical opportunities and valuable partnerships.</p></div><img src="${asset('our_mission.png')}" alt="BSS students" /></section><section class="story"><img src="${asset('our_story.png')}" alt="BSS story" /><div class="reveal"><p class="eyebrow">OUR STORY</p><h2>BUILT BY<br><i>STUDENTS.</i></h2><p>Business Student Society brings OSB students together through memorable events, meaningful initiatives and a network that continues beyond graduation.</p></div></section><section class="membership"><div class="reveal"><p class="eyebrow">THE BSS CARD</p><h2>YOUR KEY TO<br><i>MORE.</i></h2><p>Get access to special offers from our growing network of local partners.</p><a class="button" target="_blank" rel="noreferrer" href="https://forms.cloud.microsoft/r/d5fFFxbKKN">GET YOUR CARD</a></div><img src="${asset('membership_card.png')}" alt="BSS membership card" /></section></main>`; }
function sponsorUs() { return `<main class="form-page"><div class="reveal"><p class="eyebrow">BSS AUB / PARTNERSHIPS</p><h1>BECOME A<br><i>SPONSOR</i><br>FOR BSS.</h1><p>Put your brand in front of the OSB community and create a benefit students will value.</p><a class="button" target="_blank" rel="noreferrer" href="https://docs.google.com/forms/d/e/1FAIpQLSfNuDMnuJWkrMCicyDkYd9bCPNlkw7XeeqLfNpXhAMrXeT8Ow/viewform">SPONSOR US ↗</a></div></main>`; }
function deal(type) { const isDunkin = type === 'dunkin'; const name = isDunkin ? "DUNKIN'" : "McDONALD'S"; const img = isDunkin ? 'dunkinleb' : 'mcdonaldsleb'; const form = isDunkin ? 'https://forms.office.com/r/VQjM8gE7m9' : 'https://forms.office.com/r/NDXGRbdcBs'; return `<main class="deal-page"><section class="reveal"><p class="eyebrow">BSS MEMBER DEAL</p><h1>${name}<br><i>${isDunkin ? '10% OFF' : '20% OFF'}</i></h1><p class="deal-description">${isDunkin ? 'Enjoy 10% off with the Dunkin’ app.' : 'Enjoy 20% off select items at all McDonald’s Lebanon locations.'}</p><ol><li>Download the ${isDunkin ? "Dunkin'" : "McDonald's"} app.</li><li>Create an account using your ${isDunkin ? 'phone number' : 'AUB email'}.</li><li><a href="${form}" target="_blank" rel="noreferrer">Submit this form ↗</a></li><li>Your account will be activated within 3 working days.</li></ol></section><div class="deal-image"><img src="${sponsor(img)}" alt="${name}" /></div></main>`; }
function page(path) { const clean = path.replace(/\/$/, '') || '/'; if (clean === '/') return home(); if (clean === '/about-us') return about(); if (clean === '/sponsor-us') return sponsorUs(); if (clean === '/dunkin' || clean === '/mcdonalds') return deal(clean.slice(1)); const key = clean.slice(1); return categories[key] ? categoryPage(key) : home(); }
function setLocalHero() { if (localFile) { const hero = document.querySelector('.hero-image'); if (hero) hero.style.backgroundImage = "linear-gradient(90deg,rgba(31,4,14,.82) 0%,rgba(31,4,14,.49) 46%,rgba(31,4,14,.14) 100%),url('assets/our_mission.png')"; } }
function setupMotion() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;
  const header = document.querySelector('.site-header');
  const hero = document.querySelector('.hero');
  const image = document.querySelector('.hero-image');
  const progress = document.querySelector('.scroll-progress');
  let frame;
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  const update = () => {
    frame = 0;
    const y = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (progress) progress.style.transform = `scaleX(${y / max})`;
    header?.classList.toggle('is-scrolled', y > 24);
    if (!reduceMotion && hero && image) {
      const progressThroughHero = Math.min(1, Math.max(0, y / Math.max(1, hero.offsetHeight)));
      image.style.transform = `scale(${1.06 + progressThroughHero * .08}) translate3d(0, ${y * .16}px, 0)`;
      hero.style.setProperty('--hero-content-shift', `${y * -.17}px`);
      hero.style.setProperty('--hero-fade', `${1 - progressThroughHero * 1.25}`);
    }
  };
  const reveal = [...document.querySelectorAll('.reveal, .sponsor-card')];
  const observer = reduceMotion ? null : new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: .12, rootMargin: '0px 0px -7% 0px' });
  if (reduceMotion) reveal.forEach((item) => item.classList.add('is-visible'));
  else reveal.forEach((item, index) => { item.style.setProperty('--reveal-order', index % 6); observer.observe(item); });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
  return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); observer?.disconnect(); if (frame) cancelAnimationFrame(frame); };
}
function render() { stopMotion(); const path = currentRoute(); document.getElementById('app').innerHTML = '<div class="scroll-progress" aria-hidden="true"></div>' + header() + page(path) + footer(); setLocalHero(); bind(); stopMotion = setupMotion(); }
function bind() { document.querySelectorAll('[data-route]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); navigate(a.getAttribute('href')); })); const menu = document.querySelector('.menu-button'); const nav = document.querySelector('.nav'); menu?.addEventListener('click', () => { nav.classList.toggle('open'); menu.setAttribute('aria-expanded', nav.classList.contains('open')); }); document.querySelector('.sponsor-menu button')?.addEventListener('click', (event) => { if (innerWidth > 800) return; event.preventDefault(); const dropdown = document.querySelector('.dropdown'); const isOpen = dropdown.classList.toggle('open'); event.currentTarget.setAttribute('aria-expanded', String(isOpen)); }); }
addEventListener('popstate', render); addEventListener('hashchange', render); render();
