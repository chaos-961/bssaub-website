// Category ruler (§6.4): sticky left rail with a marker riding section scroll
// progress; active label grows and takes accent. Mobile gets the floating
// chip that morphs text on zone change (rail is CSS-only there).
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initCategoryRuler(scroll) {
  const section = document.querySelector('[data-perk-field]');
  const ruler = document.querySelector('[data-ruler]');
  if (!section || !ruler) return;

  const marker = ruler.querySelector('[data-ruler-marker]');
  const chip = document.querySelector('[data-perk-chip]');
  const chipText = chip?.querySelector('[data-chip-text]');

  const labels = new Map();
  ruler.querySelectorAll('[data-ruler-label]').forEach((li) => {
    labels.set(li.dataset.rulerLabel, li);
  });

  // marker slides with scroll progress; scrub only where scroll IS the mechanic (§7)
  if (marker && !scroll.reduced) {
    const setY = gsap.quickSetter(marker, 'y', 'px');
    const track = ruler.querySelector('.perk-ruler__track');
    ScrollTrigger.create({
      trigger: section,
      start: 'top 65%',
      end: 'bottom 35%',
      onUpdate: (self) => {
        const h = (track?.clientHeight || 400) - marker.clientHeight;
        setY(self.progress * h);
      },
    });
  } else if (marker) {
    marker.style.display = 'none';
  }

  // active category — feeds both the rail labels and the mobile chip
  const setActive = (id) => {
    labels.forEach((li) => li.classList.remove('is-active'));
    const label = labels.get(id);
    label?.classList.add('is-active');
    if (chip && chipText && chip.dataset.current !== id) {
      chip.dataset.current = id;
      const text = label?.textContent || id;
      if (scroll.reduced) {
        chipText.textContent = text;
      } else {
        gsap
          .timeline()
          .to(chipText, {
            yPercent: 40,
            autoAlpha: 0,
            duration: 0.16,
            ease: 'power2.in',
            onComplete: () => {
              chipText.textContent = text;
            },
          })
          .fromTo(
            chipText,
            { yPercent: -40, autoAlpha: 0 },
            { yPercent: 0, autoAlpha: 1, duration: 0.24, ease: 'power2.out' },
          );
      }
    }
  };

  section.querySelectorAll('[data-zone]').forEach((zoneEl) => {
    ScrollTrigger.create({
      trigger: zoneEl,
      start: 'top center',
      end: 'bottom center',
      onToggle: (self) => {
        if (self.isActive) setActive(zoneEl.dataset.zone);
      },
    });
  });

  // chip appears only while the field is on screen
  if (chip) {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 70%',
      end: 'bottom 30%',
      onToggle: (self) => chip.classList.toggle('is-visible', self.isActive),
    });
  }
}
