const MENU_ID = 'lemtel-call';

function normalizePhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (String(value || '').trim().startsWith('+') && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
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

function notify(title, message) {
  chrome.notifications?.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
  }, () => void chrome.runtime.lastError);
}

function setLastDialState(state) {
  chrome.storage.local.set({
    lemtel_last_dial: {
      ...state,
      at: new Date().toISOString(),
      extensionVersion: chrome.runtime.getManifest().version,
    },
  });
}

async function ensureContextMenu() {
  try {
    await chrome.contextMenus.remove(MENU_ID);
  } catch (_) {
    // Menu may not exist yet.
  }
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Call %s with Lemtel Telecom',
    contexts: ['selection'],
  }, () => void chrome.runtime.lastError);
}

chrome.runtime.onInstalled.addListener((details) => {
  ensureContextMenu();
  chrome.storage.local.set({
    lemtel_extension_version: chrome.runtime.getManifest().version,
    lemtel_connected: true,
  });
  console.log('Lemtel Telecom extension installed or updated', details.reason);
});

chrome.runtime.onStartup?.addListener(() => {
  ensureContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const normalized = normalizePhoneNumber(info.selectionText);
  if (normalized) dialViaDesktop(normalized, tab);
  else notify('Lemtel Telecom', 'The selected text is not a valid phone number.');
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DIAL') {
    const result = dialViaDesktop(msg.number, sender.tab);
    sendResponse(result);
    return false;
  }

  if (msg.type === 'SHOW_CONTEXT_MENU') {
    chrome.storage.session?.set({ pendingCall: msg.number });
    sendResponse({ success: true });
    return false;
  }

  if (msg.type === 'GET_STATUS') {
    chrome.storage.local.get(['lemtel_connected', 'lemtel_extension', 'lemtel_last_dial', 'lemtel_extension_version'], (result) => {
      sendResponse({
        connected: result.lemtel_connected !== false,
        extension: result.lemtel_extension || null,
        lastDial: result.lemtel_last_dial || null,
        version: result.lemtel_extension_version || chrome.runtime.getManifest().version,
      });
    });
    return true;
  }

  return false;
});

// Triggers the system / linked desktop or mobile phone app via the tel: protocol.
// The current tab is never navigated away, avoiding accidental portal redirects.
function dialViaDesktop(number) {
  const normalized = normalizePhoneNumber(number);
  if (!normalized) {
    setLastDialState({ success: false, number: String(number || ''), error: 'INVALID_NUMBER' });
    return { success: false, error: 'INVALID_NUMBER' };
  }

  const telUrl = `tel:${encodeURIComponent(normalized)}`;
  setLastDialState({ success: true, number: normalized, display: formatDisplay(normalized), method: 'tel-protocol' });

  chrome.windows.create({
    url: telUrl,
    type: 'popup',
    width: 120,
    height: 80,
    focused: false,
  }, (win) => {
    const err = chrome.runtime.lastError;
    if (err) {
      setLastDialState({ success: false, number: normalized, error: err.message || 'TEL_PROTOCOL_FAILED' });
      notify('Lemtel Telecom', `Unable to open phone app: ${err.message || 'tel: failed'}`);
      return;
    }
    if (win?.id) {
      setTimeout(() => chrome.windows.remove(win.id, () => void chrome.runtime.lastError), 450);
    }
  });

  return { success: true, number: normalized, display: formatDisplay(normalized) };
}
