chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'lemtel-call',
    title: '📞 Call with Lemtel Telecom',
    contexts: ['selection'],
  });
  console.log('Lemtel Telecom extension installed');
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'lemtel-call') {
    const number = info.selectionText.replace(/\D/g, '');
    if (number.length >= 10) {
      dialViaDesktop(number, tab);
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DIAL') {
    dialViaDesktop(msg.number, sender.tab);
    sendResponse({ success: true });
  }

  if (msg.type === 'SHOW_CONTEXT_MENU') {
    chrome.storage.session?.set({ pendingCall: msg.number });
  }

  if (msg.type === 'GET_STATUS') {
    chrome.storage.local.get(['lemtel_connected', 'lemtel_extension'], (result) => {
      sendResponse({
        connected: result.lemtel_connected || false,
        extension: result.lemtel_extension || null,
      });
    });
    return true;
  }
});

// Triggers the system / linked-mobile phone app via the tel: protocol.
// We open a tiny popup window so the current tab is never navigated away,
// and we never fall back to the web portal (that was opening avastatistic.ca).
function dialViaDesktop(number) {
  const clean = String(number).replace(/\D/g, '');
  if (!clean) return;
  chrome.windows.create({
    url: `tel:${clean}`,
    type: 'popup',
    width: 1,
    height: 1,
    focused: false,
  }, (win) => {
    // Close immediately — the OS has already received the tel: handoff.
    if (win?.id) setTimeout(() => chrome.windows.remove(win.id).catch(() => {}), 300);
  });
}
