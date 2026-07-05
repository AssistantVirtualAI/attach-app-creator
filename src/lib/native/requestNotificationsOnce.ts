// Ask the OS for notification permission ONCE per install.
// No-op in web preview. Native dialog is shown by iOS/Android automatically.
export async function requestNotificationsOnce(): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: "notif_permission_asked" });
    if (value === "true") return;
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.requestPermissions().catch(() => undefined);
    await Preferences.set({ key: "notif_permission_asked", value: "true" });
  } catch (e) {
    console.warn("[permissions] notifications request failed", e);
  }
}
