/**
 * Lightweight runtime accessibility check for call controls.
 * Verifies every interactive control inside `[role="toolbar"]` and tagged
 * `.lemtel-focus` has an accessible name AND is keyboard reachable.
 *
 * Auto-runs in development on mount + whenever the DOM changes inside the
 * softphone pane. Findings are printed to console.warn so QA can spot
 * regressions without needing an external a11y test runner.
 */
export interface A11yFinding {
  el: HTMLElement;
  selector: string;
  problem: string;
}

function describe(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.className && typeof el.className === 'string'
    ? '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
    : '';
  return `${tag}${id}${cls}`;
}

function accessibleName(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label')?.trim();
  if (aria) return aria;
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const ref = document.getElementById(labelledby);
    if (ref?.textContent?.trim()) return ref.textContent.trim();
  }
  const text = el.textContent?.replace(/\s+/g, ' ').trim();
  if (text) return text;
  const title = el.getAttribute('title')?.trim();
  if (title) return title;
  return '';
}

function isKeyboardReachable(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled')) return true; // disabled is intentional
  const tabIndex = el.getAttribute('tabindex');
  if (tabIndex !== null && parseInt(tabIndex, 10) < 0) return false;
  // Buttons/links/inputs/selects are reachable by default
  const tag = el.tagName.toLowerCase();
  if (['button', 'a', 'input', 'select', 'textarea'].includes(tag)) return true;
  return tabIndex !== null && parseInt(tabIndex, 10) >= 0;
}

export function auditCallControls(root: ParentNode = document): A11yFinding[] {
  const findings: A11yFinding[] = [];
  const controls = root.querySelectorAll<HTMLElement>(
    '[role="toolbar"] button, [role="toolbar"] a, [role="toolbar"] [role="button"], .lemtel-focus, .lemtel-glass'
  );
  controls.forEach((el) => {
    const sel = describe(el);
    if (!accessibleName(el)) {
      findings.push({ el, selector: sel, problem: 'missing accessible name (aria-label / text / title)' });
    }
    if (!isKeyboardReachable(el)) {
      findings.push({ el, selector: sel, problem: 'not keyboard reachable (negative tabindex)' });
    }
  });
  return findings;
}

let scheduled = false;
export function scheduleA11yAudit(label = 'softphone') {
  if (!import.meta.env.DEV) return;
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    const findings = auditCallControls(document);
    if (findings.length === 0) {
      console.info(`[a11y:${label}] ✓ all ${document.querySelectorAll('.lemtel-focus,.lemtel-glass').length} controls labeled & reachable`);
    } else {
      console.warn(`[a11y:${label}] ${findings.length} issue(s):`);
      findings.forEach((f) => console.warn(`  ✗ ${f.selector} — ${f.problem}`, f.el));
    }
  }, 600);
}

/** Observe DOM changes inside `root` and re-audit, with debounce. */
export function watchA11y(root: HTMLElement, label = 'softphone'): () => void {
  if (!import.meta.env.DEV) return () => {};
  scheduleA11yAudit(label);
  const mo = new MutationObserver(() => scheduleA11yAudit(label));
  mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'aria-pressed', 'disabled', 'tabindex'] });
  return () => mo.disconnect();
}
