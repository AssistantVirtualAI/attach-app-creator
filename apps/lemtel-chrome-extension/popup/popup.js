document.addEventListener('DOMContentLoaded', async () => {
  const dialInput = document.getElementById('dial-input');
  const callBtn = document.getElementById('call-btn');
  const numbersList = document.getElementById('numbers-list');
  const numbersCount = document.getElementById('numbers-count');
  const statusDot = document.getElementById('status-indicator');
  const accountInfo = document.getElementById('account-info');
  const extNumber = document.getElementById('ext-number');

  const PHONE_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="white"/></svg>`;
  const PHONE_ICON_LG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="white"/></svg>`;

  chrome.storage.local.get(['lemtel_connected','lemtel_extension'], (result) => {
    if (result.lemtel_connected && result.lemtel_extension) {
      statusDot.className = 'status-dot connected';
      accountInfo.classList.remove('hidden');
      extNumber.textContent = result.lemtel_extension;
    }
  });

  dialInput.addEventListener('input', () => {
    const clean = dialInput.value.replace(/\D/g, '');
    callBtn.disabled = clean.length < 10;
  });

  dialInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !callBtn.disabled) {
      makeCall(dialInput.value.replace(/\D/g, ''));
    }
  });

  callBtn.addEventListener('click', () => {
    const number = dialInput.value.replace(/\D/g, '');
    if (number.length >= 10) makeCall(number);
  });


  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab?.id) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const PHONE_REGEX = /(\+?1?\s*[-.]?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g;
          const matches = document.body.innerText.match(PHONE_REGEX) || [];
          return [...new Set(matches)].slice(0, 10);
        }
      });

      const numbers = results?.[0]?.result || [];
      numbersCount.textContent = numbers.length;

      if (numbers.length > 0) {
        numbersList.innerHTML = '';
        numbers.forEach((num) => {
          const clean = num.replace(/\D/g, '');
          const item = document.createElement('div');
          item.className = 'number-item';
          item.innerHTML = `
            <span class="number-text">${num.trim()}</span>
            <button class="number-call-btn" data-number="${clean}" title="Call ${num}">${PHONE_ICON}</button>
          `;
          item.querySelector('.number-call-btn').addEventListener('click', () => makeCall(clean));
          numbersList.appendChild(item);
        });
      }
    } catch (e) {
      console.log('Cannot access page:', e);
    }
  }

  function makeCall(number) {
    // Route through the background worker so we never navigate the active tab
    // (which previously caused a fallback to avastatistic.ca). The background
    // hands off to the OS / linked mobile phone app via the tel: protocol.
    chrome.runtime.sendMessage({ type: 'DIAL', number });
    callBtn.innerHTML = '✅';
    setTimeout(() => { callBtn.innerHTML = PHONE_ICON_LG; }, 2000);
    window.close();
  }
});
