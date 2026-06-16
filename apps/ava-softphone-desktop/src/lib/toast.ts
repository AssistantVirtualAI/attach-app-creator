// Tiny self-contained toast helper for the Electron app (no extra deps).
// Renders a top-right stack; supports success / error / info variants.
type ToastKind = 'success' | 'error' | 'info';

let containerEl: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (containerEl && document.body.contains(containerEl)) return containerEl;
  const el = document.createElement('div');
  el.setAttribute('data-ava-toast-root', '');
  el.style.cssText = [
    'position:fixed', 'top:16px', 'right:16px', 'z-index:99999',
    'display:flex', 'flex-direction:column', 'gap:8px', 'pointer-events:none',
    'max-width:360px', 'font-family:Inter, system-ui, sans-serif',
  ].join(';');
  document.body.appendChild(el);
  containerEl = el;
  return el;
}

function show(message: string, kind: ToastKind = 'info', ttlMs = 3200) {
  const root = ensureContainer();
  const palette: Record<ToastKind, { bg: string; bd: string; fg: string; icon: string }> = {
    success: { bg: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(11,181,214,0.14))', bd: 'rgba(16,185,129,0.55)', fg: '#d1fae5', icon: '✓' },
    error:   { bg: 'linear-gradient(135deg, rgba(220,38,38,0.20), rgba(122,76,255,0.12))',  bd: 'rgba(220,38,38,0.55)', fg: '#fee2e2', icon: '⚠' },
    info:    { bg: 'linear-gradient(135deg, rgba(11,181,214,0.18), rgba(122,76,255,0.14))', bd: 'rgba(11,181,214,0.55)', fg: '#e6f6ff', icon: 'ℹ' },
  };
  const p = palette[kind];
  const node = document.createElement('div');
  node.style.cssText = [
    `background:${p.bg}`, `border:1px solid ${p.bd}`, `color:${p.fg}`,
    'border-radius:12px', 'padding:10px 12px', 'font-size:12.5px', 'font-weight:600',
    'box-shadow:0 8px 28px -10px rgba(0,0,0,0.6)', 'backdrop-filter:blur(10px)',
    'pointer-events:auto', 'display:flex', 'gap:10px', 'align-items:flex-start',
    'opacity:0', 'transform:translateY(-6px)', 'transition:opacity 180ms ease, transform 180ms ease',
    'min-width:240px', 'max-width:360px',
  ].join(';');
  node.innerHTML = `<span style="font-size:14px;line-height:1.1">${p.icon}</span><span style="white-space:pre-wrap"></span>`;
  (node.lastChild as HTMLSpanElement).textContent = message;
  root.appendChild(node);
  requestAnimationFrame(() => { node.style.opacity = '1'; node.style.transform = 'translateY(0)'; });
  window.setTimeout(() => {
    node.style.opacity = '0';
    node.style.transform = 'translateY(-6px)';
    window.setTimeout(() => { node.remove(); }, 220);
  }, ttlMs);
}

export const toast = {
  success: (m: string) => show(m, 'success'),
  error:   (m: string) => show(m, 'error', 4500),
  info:    (m: string) => show(m, 'info'),
};
