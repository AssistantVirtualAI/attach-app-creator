// Utility that scans a root element and detects:
//  1. Interactive elements (buttons, links, inputs) clipped out of their
//     scroll containers (i.e. hidden by overflow).
//  2. Pairs of interactive elements whose rendered rects overlap by more
//     than a small tolerance (likely visual chevauchement).
//
// Used by ResponsiveLab to verify the layout at multiple widths.

export type OverlapIssue =
  | { kind: 'clipped'; selector: string; label: string; rect: DOMRect }
  | { kind: 'overlap'; a: string; b: string; aLabel: string; bLabel: string; area: number };

const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';

function describe(el: Element): { sel: string; label: string } {
  const tag = el.tagName.toLowerCase();
  const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
  const cls = (el as HTMLElement).className && typeof (el as HTMLElement).className === 'string'
    ? '.' + (el as HTMLElement).className.toString().trim().split(/\s+/).slice(0, 2).join('.')
    : '';
  const label =
    el.getAttribute('aria-label') ||
    (el as HTMLElement).innerText?.trim().slice(0, 30) ||
    el.getAttribute('title') ||
    tag;
  return { sel: `${tag}${id}${cls}`, label };
}

function intersectionArea(a: DOMRect, b: DOMRect): number {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

export function detectOverlaps(root: HTMLElement | Document = document): OverlapIssue[] {
  const issues: OverlapIssue[] = [];
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(INTERACTIVE))
    .filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);

  // 1) Clipped by ancestor overflow
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    let p: HTMLElement | null = el.parentElement;
    while (p) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'hidden' || cs.overflowY === 'hidden' || cs.overflow === 'hidden') {
        const pr = p.getBoundingClientRect();
        const horiz = r.right > pr.right + 1 || r.left < pr.left - 1;
        const vert = r.bottom > pr.bottom + 1 || r.top < pr.top - 1;
        if ((cs.overflowX === 'hidden' && horiz) || (cs.overflowY === 'hidden' && vert) ||
            (cs.overflow === 'hidden' && (horiz || vert))) {
          const d = describe(el);
          issues.push({ kind: 'clipped', selector: d.sel, label: d.label, rect: r });
          break;
        }
      }
      p = p.parentElement;
    }
  }

  // 2) Pairwise overlap (only siblings/cousins, skip parent-child)
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    const ar = a.getBoundingClientRect();
    if (ar.width < 2 || ar.height < 2) continue;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      if (a.contains(b) || b.contains(a)) continue;
      const br = b.getBoundingClientRect();
      const area = intersectionArea(ar, br);
      if (area > 16) {
        const minArea = Math.min(ar.width * ar.height, br.width * br.height);
        if (area / minArea > 0.25) {
          const da = describe(a);
          const db = describe(b);
          issues.push({ kind: 'overlap', a: da.sel, b: db.sel, aLabel: da.label, bLabel: db.label, area: Math.round(area) });
        }
      }
    }
  }

  return issues;
}
