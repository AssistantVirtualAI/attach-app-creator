import { Preferences } from '@capacitor/preferences';

const PREFER_C2C_KEY = 'lemtel.prefer_click_to_call';

export async function getPreferClickToCall(): Promise<boolean> {
  try {
    if ((Preferences as any)?.get) {
      const { value } = await Preferences.get({ key: PREFER_C2C_KEY });
      if (value === 'off') return false;
      if (value === 'on') return true;
    }
  } catch {}
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem('prefer_click_to_call') : null;
  return v !== 'off';
}

export async function setPreferClickToCall(val: boolean) {
  const str = val ? 'on' : 'off';
  try {
    if ((Preferences as any)?.set) {
      await Preferences.set({ key: PREFER_C2C_KEY, value: str });
      return;
    }
  } catch {}
  if (typeof localStorage !== 'undefined') localStorage.setItem('prefer_click_to_call', str);
}
