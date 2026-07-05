// Request the 3 native permissions in sequence, once per install, on native
// platforms only. Fire-and-forget — never blocks navigation. Each dialog is
// the native OS dialog (no custom UI).
export async function requestPermissionsAfterLogin(): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;

    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: "permissions_requested_v1" });
    if (value === "true") return;
    await Preferences.set({ key: "permissions_requested_v1", value: "true" });

    // 1. Microphone — native OS dialog via getUserMedia
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch { /* denied — handled contextually */ }

    await new Promise(r => setTimeout(r, 500));

    // 2. Contacts
    try {
      const { Contacts } = await import("@capacitor-community/contacts");
      await Contacts.requestPermissions();
    } catch { /* not available or denied */ }

    await new Promise(r => setTimeout(r, 500));

    // 3. Push notifications
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.requestPermissions();
    } catch { /* not available or denied */ }
  } catch (e) {
    console.warn("[permissions] requestPermissionsAfterLogin failed", e);
  }
}
