import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export async function requestPermissionsAfterLogin(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const { value } = await Preferences.get({ key: 'permissions_requested_v1' });
  if (value === 'true') return;
  await Preferences.set({ key: 'permissions_requested_v1', value: 'true' });

  // 1. Microphone
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
  } catch { }

  await new Promise(r => setTimeout(r, 800));

  // 2. Contacts — DO NOT auto-request. App Store Guideline 5.1.2 requires an
  //    explicit in-app consent screen (ContactsConsentSheet) before the iOS
  //    prompt is triggered, because we upload contacts to our server.
  //    The sheet is shown the first time the user opens a contacts feature.


  await new Promise(r => setTimeout(r, 800));

  // 3. Notifications
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.requestPermissions();
  } catch { }
}
