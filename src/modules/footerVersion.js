// Footer version badge (§6.7). Imports version.json at build time, so the
// badge always equals the shipped version.json (rule §1.4).
import { version } from '../../version.json';

export function initFooterVersion() {
  document.querySelectorAll('[data-version-badge]').forEach((el) => {
    el.textContent = `v${version}`;
  });
}
