/* 100 Lebanese first names for the hero card's NAME blank (v0.3.9).
   Christian and Muslim, male and female, roughly the mix a lecture hall at
   AUB actually holds, because the point of the card writing a name onto
   itself is that a visitor sees one that could be theirs.

   Two rules bind this list:
     - NO HYPHENS (§ rule 4), so Marie Rose and Abdel Karim style compounds
       stay out entirely rather than shipping with a dash in user visible copy.
     - NO DIACRITICS, since these are rendered into an SVG on the card in
       Instrument Sans and a stray accent is the one glyph most likely to fall
       back to a different face mid word.

   Stored as one space delimited string, not an array of quoted entries: the JS
   budget sits at 95.9KB gz of 100 (§ Budgets) and the quote-and-comma tax on
   100 entries is ~300 bytes of pure syntax. Split once, at module load. */
export const FIRST_NAMES =
  `Ali Hassan Hussein Mohammad Ahmad Omar Khaled Mahmoud Bilal Youssef
   Jamal Kamal Mustafa Hadi Ibrahim Zein Wael Abbas Mounir Bassam
   Talal Ayman Hamza Adnan Nizar Charbel Georges Elie Antoine Joseph
   Michel Rabih Tony Marc Roy Ziad Fadi Nabil Sami Karim
   Chady Gilbert Jad Bechara Naji Elias Wissam Roger Maroun Rami
   Rodrigue Nadim Serge Toufic Jean Patrick Fouad Samir Walid Riad
   Maya Nour Rita Christelle Joelle Carla Yara Lea Nadine Sandra
   Perla Tatiana Josephine Gaelle Cynthia Christina Marielle Rose Elissa Nayla
   Roula Stephanie Vanessa Zeina Hiba Rana Layal Fatima Aya Zahraa
   Malak Reem Dana Rasha Salma Nada Lama Ghina Jana Batoul`.split(/\s+/);
