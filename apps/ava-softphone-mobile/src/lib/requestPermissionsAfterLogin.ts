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

  // 2. Contacts
  try {
    const { Contacts } = await import('@capacitor-community/contacts');
    await Contacts.requestPermissions();
  } catch { }

  await new Promise(r => setTimeout(r, 800));

  // 3. Notifications
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.requestPermissions();
  } catch { }
}
