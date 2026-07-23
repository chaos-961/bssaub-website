// ---------------------------------------------------------------------------
// Single source of truth for every sponsor (§5). VERIFIED ENTRIES ONLY —
// rule §1.5: nothing guessed, nothing marked "?" ever ships.
//
// Schema:
//   id         kebab-case, must equal the image filename
//   name       display name
//   category   restaurants | clothing | health-beauty | fitness | services
//   discount   badge text
//   instagram  full profile URL
//   image      public path (webp generated in Phase 3 from assets/Sponsored/)
//   size       relative bubble scale — mapped from discount:
//              10% → 1.0 · 15% → 1.05 · 20% → 1.10 · 25% → 1.15 · 30% → 1.20
//   discount   null = sponsor is real and links out, but the % is unverified
//              (§1.5) — bubble renders WITHOUT a badge until §13.2 data lands
//   details    OPTIONAL — presence = popup instead of direct Instagram link
//
// ---------------------------------------------------------------------------
// PENDING DATA (§13.2 — badges appear the moment the user confirms the %):
//   discounts   sushi-bell (15%?) · craves-burger (10%?) · fattouh (20%?) ·
//               munchease-diner (20%?) · joy-of-beirut (10%?) · dunkin (?) ·
//               dentspa-dr-rabah (?) · the-kalm-studio (?)
//   dunkin      popup redemption details also missing (ships as direct IG link)
// VERIFIED 2026-07-23 via web search (old site down, per the user):
//   craves-burger → @cravesburger (Mar Mikhael; @craveslb doesn't surface)
//   padel-square  → @padelsquare.lb (real account, Saida)
//   the-kalm-studio → @thekalmstudio — Pilates studio in Beirut ⇒ fitness
// EXCLUDED: design-lab — prior session locked "exclude Design Lab entirely";
//   no image in assets/Sponsored/ either.
// ---------------------------------------------------------------------------

export const sponsors = [
  /* ------------------------------ restaurants ---------------------------- */
  {
    id: 'baguette-bistro',
    name: 'Baguette Bistro',
    category: 'restaurants',
    discount: '20% OFF',
    instagram: 'https://www.instagram.com/baguettebistrolb',
    image: 'assets/sponsors/restaurants/baguette-bistro.webp',
    size: 1.1,
  },
  {
    id: 'kibbe-kitchen',
    name: 'Kibbe Kitchen',
    category: 'restaurants',
    discount: '10% OFF',
    instagram: 'https://www.instagram.com/kibbekitchen',
    image: 'assets/sponsors/restaurants/kibbe-kitchen.webp',
    size: 1,
  },
  {
    id: 'mcdonalds',
    name: "McDonald's",
    category: 'restaurants',
    discount: '20% OFF',
    instagram: 'https://www.instagram.com/mcdonaldsleb',
    image: 'assets/sponsors/restaurants/mcdonalds.webp',
    size: 1.1,
    details: {
      summary: "20% off select items across all McDonald's Lebanon stores",
      notes: 'Dine in, drive thru and delivery. No BSS card or AUB ID needed.',
      steps: [
        "Download the McDonald's app",
        'Create an account with your AUB email',
        'Fill the activation form',
        'Account activates within 3 working days',
      ],
      links: [{ label: 'Activation form', url: 'https://forms.office.com/r/NDXGRbdcBs' }],
    },
  },
  {
    id: 'salon-beyrouth',
    name: 'Salon Beyrouth',
    category: 'restaurants',
    discount: '15% OFF',
    instagram: 'https://www.instagram.com/salonbeyrouth',
    image: 'assets/sponsors/restaurants/salon-beyrouth.webp',
    size: 1.05,
  },
  {
    id: 'allo-beirut',
    name: 'Allo Beirut',
    category: 'restaurants',
    discount: '10% OFF',
    instagram: 'https://www.instagram.com/allobeirut.lb',
    image: 'assets/sponsors/restaurants/allo-beirut.webp',
    size: 1,
  },
  {
    id: 'cravy',
    name: 'Cravy',
    category: 'restaurants',
    discount: '10% OFF',
    instagram: 'https://www.instagram.com/cravylb',
    image: 'assets/sponsors/restaurants/cravy.webp',
    size: 1,
  },
  {
    id: 'smash-it',
    name: 'Smash It',
    category: 'restaurants',
    discount: '15% OFF',
    instagram: 'https://www.instagram.com/smash.it.1',
    image: 'assets/sponsors/restaurants/smash-it.webp',
    size: 1.05,
  },
  {
    id: 'papas-mia-tacos',
    name: "Papa's Mia Tacos",
    category: 'restaurants',
    discount: '30% OFF',
    instagram: 'https://www.instagram.com/papasmiatacos',
    image: 'assets/sponsors/restaurants/papas-mia-tacos.webp',
    size: 1.2,
  },
  {
    id: 'sushi-bell',
    name: 'Sushi Bell',
    category: 'restaurants',
    discount: null, // 15%? — unverified (§13.2)
    instagram: 'https://www.instagram.com/sushi_bell',
    image: 'assets/sponsors/restaurants/sushi-bell.webp',
    size: 1,
  },
  {
    id: 'craves-burger',
    name: 'Craves Burger',
    category: 'restaurants',
    discount: null, // 10%? — unverified (§13.2)
    instagram: 'https://www.instagram.com/cravesburger',
    image: 'assets/sponsors/restaurants/craves-burger.webp',
    size: 1,
  },
  {
    id: 'fattouh',
    name: 'Fattouh',
    category: 'restaurants',
    discount: null, // 20%? — unverified (§13.2)
    instagram: 'https://www.instagram.com/fattouhrestaurant',
    image: 'assets/sponsors/restaurants/fattouh.webp',
    size: 1,
  },
  {
    id: 'munchease-diner',
    name: 'Munchease Diner',
    category: 'restaurants',
    discount: null, // 20%? — unverified (§13.2)
    instagram: 'https://www.instagram.com/muncheasediner',
    image: 'assets/sponsors/restaurants/munchease-diner.webp',
    size: 1,
  },
  {
    id: 'joy-of-beirut',
    name: 'Joy of Beirut',
    category: 'restaurants',
    discount: null, // 10%? — unverified (§13.2)
    instagram: 'https://www.instagram.com/joyofbeirut',
    image: 'assets/sponsors/restaurants/joy-of-beirut.webp',
    size: 1,
  },
  {
    id: 'dunkin',
    name: "Dunkin'",
    category: 'restaurants',
    discount: null, // unknown — popup redemption details also pending (§13.2)
    instagram: 'https://www.instagram.com/dunkinleb',
    image: 'assets/sponsors/restaurants/dunkin.webp',
    size: 1,
  },

  /* ------------------------------- clothing ------------------------------ */
  {
    id: 'pop-jammies',
    name: 'Pop Jammies',
    category: 'clothing',
    discount: '10% OFF',
    instagram: 'https://www.instagram.com/popjammies',
    image: 'assets/sponsors/clothing/pop-jammies.webp',
    size: 1,
  },
  {
    id: 'leaders-fit',
    name: 'Leaders Fit',
    category: 'clothing',
    discount: '25% OFF',
    instagram: 'https://www.instagram.com/leaders.fit',
    image: 'assets/sponsors/clothing/leaders-fit.webp',
    size: 1.15,
  },
  {
    id: 'belinda-atelier',
    name: 'Belinda Atelier',
    category: 'clothing',
    discount: '15% OFF',
    instagram: 'https://www.instagram.com/belinda.atelier',
    image: 'assets/sponsors/clothing/belinda-atelier.webp',
    size: 1.05,
  },

  /* ---------------------------- health & beauty -------------------------- */
  {
    id: 'pure-28-clinic',
    name: 'Pure 28 Clinic',
    category: 'health-beauty',
    discount: '15% OFF',
    instagram: 'https://www.instagram.com/pure28clinic',
    image: 'assets/sponsors/health-beauty/pure-28-clinic.webp',
    size: 1.05,
  },
  {
    id: 'pure-28-beauty',
    name: 'Pure 28 Beauty',
    category: 'health-beauty',
    discount: '15% OFF',
    instagram: 'https://www.instagram.com/pure28beauty',
    image: 'assets/sponsors/health-beauty/pure-28-beauty.webp',
    size: 1.05,
  },
  {
    id: 'optique-et-vision',
    name: 'Optique et Vision',
    category: 'health-beauty',
    discount: '25% OFF',
    instagram: 'https://www.instagram.com/optiqueetvision',
    image: 'assets/sponsors/health-beauty/optique-et-vision.webp',
    size: 1.15,
  },
  {
    id: 'dentspa-dr-rabah',
    name: 'DentSpa Dr. Rabah',
    category: 'health-beauty',
    discount: null, // unknown (§13.2)
    instagram: 'https://www.instagram.com/dentspa_drrabah',
    image: 'assets/sponsors/health-beauty/dentspa-dr-rabah.webp',
    size: 1,
  },

  /* -------------------------------- fitness ------------------------------ */
  {
    id: 'padel-loft',
    name: 'Padel Loft',
    category: 'fitness',
    discount: '25% OFF',
    instagram: 'https://www.instagram.com/padel.loft',
    image: 'assets/sponsors/fitness/padel-loft.webp',
    size: 1.15,
  },
  {
    id: 'padel-square',
    name: 'Padel Square',
    category: 'fitness',
    discount: '20% OFF', // §14 discount was never in doubt; handle verified 2026-07-23
    instagram: 'https://www.instagram.com/padelsquare.lb',
    image: 'assets/sponsors/fitness/padel-square.webp',
    size: 1.1,
  },
  {
    id: 'the-kalm-studio',
    name: 'The Kalm Studio',
    category: 'fitness', // Pilates studio, Beirut — verified 2026-07-23
    discount: null, // unknown (§13.2)
    instagram: 'https://www.instagram.com/thekalmstudio',
    image: 'assets/sponsors/fitness/the-kalm-studio.webp',
    size: 1,
  },

  /* ------------------------------- services ------------------------------ */
  {
    id: 'simple-a-tutoring',
    name: 'Simple A Tutoring',
    category: 'services',
    discount: '20% OFF',
    instagram: 'https://www.instagram.com/simplea_tutoring',
    image: 'assets/sponsors/services/simple-a-tutoring.webp',
    size: 1.1,
  },
];

export const categories = [
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'clothing', label: 'Clothing' },
  { id: 'health-beauty', label: 'Health & Beauty' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'services', label: 'Services' },
];
