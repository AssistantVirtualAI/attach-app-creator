document.addEventListener('DOMContentLoaded', async () => {
  const dialInput = document.getElementById('dial-input');
  const callBtn = document.getElementById('call-btn');
  const numbersList = document.getElementById('numbers-list');
  const numbersCount = document.getElementById('numbers-count');
  const statusDot = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const accountInfo = document.getElementById('account-info');
  const extNumber = document.getElementById('ext-number');
  const versionText = document.getElementById('version-text');
  const lastDialText = document.getElementById('last-dial-text');

  const PHONE_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="white"/></svg>`;
  const PHONE_ICON_LG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="white"/></svg>`;

  const PHONE_REGEX = /(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g;
  const manifest = chrome.runtime.getManifest();
  versionText.textContent = `v${manifest.version}`;

  function normalizePhoneNumber(value) {
    const original = String(value || '').trim();
    const digits = original.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (original.startsWith('+') && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
    if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
    return null;
  }

  function formatDisplay(value) {
    const normalized = normalizePhoneNumber(value);
    if (!normalized) return String(value || '');
    const digits = normalized.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return normalized;
  }

  function setStatus(connected, label) {
    statusDot.className = connected ? 'status-dot connected' : 'status-dot warning';
    statusDot.title = label;
    statusText.textContent = label;
  }

  function updateCallButton() {
    callBtn.disabled = !normalizePhoneNumber(dialInput.value);
  }

  function renderLastDial(lastDial) {
    if (!lastDial) {
      lastDialText.textContent = 'Ready to open your Mac phone app with tel: links.';
      return;
    }
    if (lastDial.success) {
      lastDialText.textContent = `Last handoff: ${lastDial.display || formatDisplay(lastDial.number)}.`;
      return;
    }
    lastDialText.textContent = `Last handoff failed: ${lastDial.error || 'unknown error'}.`;
  }

  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (status) => {
    if (chrome.runtime.lastError || !status) {
      setStatus(false, 'Extension status unavailable');
      return;
    }

    setStatus(Boolean(status.connected), status.connected ? 'Ready for click-to-call' : 'Needs configuration');
    renderLastDial(status.lastDial);

    if (status.extension) {
      accountInfo.classList.remove('hidden');
      extNumber.textContent = status.extension;
    } else {
      accountInfo.classList.remove('hidden');
      extNumber.textContent = 'Desktop phone app';
    }
  });

  dialInput.addEventListener('input', updateCallButton);

  dialInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !callBtn.disabled) {
      makeCall(dialInput.value);
    }
  });

  callBtn.addEventListener('click', () => {
    if (!callBtn.disabled) makeCall(dialInput.value);
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab?.id) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const PHONE_REGEX = /(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g;
          const text = document.body?.innerText || '';
          const matches = text.match(PHONE_REGEX) || [];
          return [...new Set(matches.map((n) => n.trim()).filter(Boolean))].slice(0, 12);
        }
      });

      const numbers = (results?.[0]?.result || []).filter(normalizePhoneNumber);
      numbersCount.textContent = numbers.length;

      if (numbers.length > 0) {
        numbersList.innerHTML = '';
        numbers.forEach((num) => {
          const normalized = normalizePhoneNumber(num);
          const item = document.createElement('div');
          item.className = 'number-item';
          item.innerHTML = `
            <span class="number-text">${formatDisplay(num)}</span>
            <button class="number-call-btn" data-number="${normalized}" title="Call ${formatDisplay(num)}">${PHONE_ICON}</button>
          `;
          item.querySelector('.number-call-btn').addEventListener('click', () => makeCall(normalized));
          numbersList.appendChild(item);
        });
      }
    } catch (e) {
      numbersList.innerHTML = '<div class="empty-state">Cannot scan this Chrome page. Use Quick Dial instead.</div>';
      console.log('Cannot access page:', e);
    }
  }

  function makeCall(number) {
    const normalized = normalizePhoneNumber(number);
    if (!normalized) {
      lastDialText.textContent = 'Enter a valid 10-digit phone number.';
      updateCallButton();
      return;
    }

    chrome.runtime.sendMessage({ type: 'DIAL', number: normalized }, (result) => {
      if (chrome.runtime.lastError || !result?.success) {
        const message = result?.error || chrome.runtime.lastError?.message || 'Unable to open tel: link.';
        lastDialText.textContent = `Call handoff failed: ${message}`;
        callBtn.innerHTML = '!';
        setTimeout(() => { callBtn.innerHTML = PHONE_ICON_LG; updateCallButton(); }, 1800);
        return;
      }
      lastDialText.textContent = `Opening phone app for ${result.display || formatDisplay(normalized)}.`;
      callBtn.innerHTML = '✓';
      setTimeout(() => { callBtn.innerHTML = PHONE_ICON_LG; updateCallButton(); }, 1800);
    });
  }
});
