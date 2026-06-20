/**
 * Device contacts sync for the dialer autocomplete.
 * Reads contacts via @capacitor-community/contacts and caches a slim version
 * in sessionStorage so the dialer stays fast.
 */
import { Capacitor } from '@capacitor/core';

export interface PhoneEntry { number: string; label?: string }
export interface DeviceContact {
  id: string;
  name: string;
  /** numéros (avec libellé : mobile, work, home…). */
  phones: PhoneEntry[];
  /** alias plat conservé pour compat ascendante. */
  numbers: string[];
  emails?: string[];
}

const CACHE_KEY = 'lemtel-device-contacts';

export async function syncDeviceContacts(): Promise<DeviceContact[]> {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const { Contacts } = await import('@capacitor-community/contacts');
    const perm = await Contacts.checkPermissions();
    if (perm.contacts !== 'granted') {
      const req = await Contacts.requestPermissions();
      if (req.contacts !== 'granted') return [];
    }
    const result = await Contacts.getContacts({
      projection: { name: true, phones: true, emails: true },
    });
    const contacts: DeviceContact[] = (result.contacts || [])
      .map((c: any) => ({
        id: c.contactId,
        name: c.name?.display || [c.name?.given, c.name?.family].filter(Boolean).join(' ') || 'Unknown',
        numbers: (c.phones || []).map((p: any) => p.number).filter(Boolean),
        emails: (c.emails || []).map((e: any) => e.address).filter(Boolean),
      }))
      .filter((c) => c.numbers.length > 0);

    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(contacts)); } catch {}
    return contacts;
  } catch (e) {
    console.warn('[contacts] sync failed', e);
    return [];
  }
}

export function loadCachedContacts(): DeviceContact[] {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function searchContacts(query: string, contacts?: DeviceContact[]): DeviceContact[] {
  const pool = contacts || loadCachedContacts();
  if (!query) return pool.slice(0, 50);
  const q = query.toLowerCase().replace(/\s+/g, '');
  return pool
    .filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.numbers.some((n) => n.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
    )
    .slice(0, 50);
}
