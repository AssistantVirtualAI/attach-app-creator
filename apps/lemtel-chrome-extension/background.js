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

function dialViaDesktop(number, tab) {
  if (tab?.id) {
    chrome.tabs.update(tab.id, { url: `lemtel://call/${number}` });
  }

  setTimeout(() => {
    chrome.storage.local.get(['lemtel_portal_url'], (result) => {
      const portal = result.lemtel_portal_url || 'https://avastatistic.ca';
      chrome.tabs.create({
        url: `${portal}/dial?number=${number}`,
        active: false,
      });
    });
  }, 1000);
}
