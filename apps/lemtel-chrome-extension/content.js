(function() {
  'use strict';

  const PHONE_REGEX = /(\+?1?\s*[-.]?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g;

  function cleanNumber(num) {
    return num.replace(/\D/g, '');
  }

  function formatDisplay(num) {
    const clean = cleanNumber(num);
    if (clean.length === 10) {
      return `(${clean.slice(0,3)}) ${clean.slice(3,6)}-${clean.slice(6)}`;
    }
    if (clean.length === 11 && clean[0] === '1') {
      return `+1 (${clean.slice(1,4)}) ${clean.slice(4,7)}-${clean.slice(7)}`;
    }
    return num;
  }

  const processed = new WeakSet();

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME',
    'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON',
    'A', 'CODE', 'PRE'
  ]);

  const PHONE_ICON_SVG = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="white"/></svg>`;

  function createCallButton(number) {
    const btn = document.createElement('a');
    btn.className = 'lemtel-call-btn';
    btn.href = `tel:${cleanNumber(number)}`;
    btn.title = `Call ${formatDisplay(number)} with Lemtel Telecom`;
    btn.innerHTML = `${PHONE_ICON_SVG}<span>${formatDisplay(number)}</span>`;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dialNumber(cleanNumber(number));
    });

    return btn;
  }

  function dialNumber(number) {
    // Hand off to the background worker which triggers the OS / linked mobile
    // phone app via tel:. Never navigate the current page (that previously
    // ended up on avastatistic.ca as a fallback).
    try {
      chrome.runtime.sendMessage({ type: 'DIAL', number });
    } catch (e) {}
    showCallNotification(number);
  }

  function showCallNotification(number) {
    const notif = document.createElement('div');
    notif.className = 'lemtel-notification';
    notif.innerHTML = `<div class="lemtel-notif-content">${PHONE_ICON_SVG}<span>Calling ${formatDisplay(number)}...</span></div>`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }

  function processTextNode(node) {
    if (processed.has(node)) return;
    if (!node.textContent.match(PHONE_REGEX)) return;

    const parent = node.parentNode;
    if (!parent) return;
    if (SKIP_TAGS.has(parent.tagName)) return;
    if (parent.classList?.contains('lemtel-call-btn')) return;

    processed.add(node);

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    const text = node.textContent;
    const regex = new RegExp(PHONE_REGEX);

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      fragment.appendChild(createCallButton(match[0]));
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    parent.replaceChild(fragment, node);
  }

  function processContainer(container) {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
          if (parent.closest('.lemtel-call-btn')) return NodeFilter.FILTER_REJECT;
          if (!node.textContent.trim()) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(processTextNode);
  }

  document.addEventListener('contextmenu', () => {
    const selection = window.getSelection()?.toString().trim();
    if (selection && selection.match(PHONE_REGEX)) {
      try {
        chrome.runtime.sendMessage({ type: 'SHOW_CONTEXT_MENU', number: selection });
      } catch (e) {}
    }
  });

  processContainer(document.body);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processContainer(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const style = document.createElement('style');
  style.textContent = `
    .lemtel-call-btn {
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      background: linear-gradient(135deg, #003DA6, #7C3AED) !important;
      color: white !important;
      border-radius: 6px !important;
      padding: 2px 8px 2px 6px !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      text-decoration: none !important;
      cursor: pointer !important;
      margin: 0 2px !important;
      vertical-align: middle !important;
      border: 1px solid rgba(255,215,0,0.3) !important;
      box-shadow: 0 2px 8px rgba(0,61,166,0.3) !important;
      transition: all 0.15s ease !important;
      white-space: nowrap !important;
      font-family: -apple-system, sans-serif !important;
    }
    .lemtel-call-btn:hover {
      background: linear-gradient(135deg, #0052CC, #9D6FF0) !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 12px rgba(0,61,166,0.5) !important;
      color: white !important;
      text-decoration: none !important;
    }
    .lemtel-call-btn:active { transform: scale(0.97) !important; }
    .lemtel-notification {
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 2147483647 !important;
      background: #050816 !important;
      border: 1px solid rgba(255,215,0,0.3) !important;
      border-radius: 12px !important;
      padding: 12px 16px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
      animation: lemtel-slide-in 0.3s ease !important;
    }
    .lemtel-notif-content {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      color: white !important;
      font-size: 13px !important;
      font-family: -apple-system, sans-serif !important;
    }
    @keyframes lemtel-slide-in {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
})();
