import { Notification, BrowserWindow } from 'electron';
import path from 'path';

export function showIncomingCallNotification(
  win: BrowserWindow | null,
  caller: string
) {
  const n = new Notification({
    title: 'Incoming Call — AVA Softphone',
    body: caller,
    icon: path.join(__dirname, '../assets/icon.png'),
    urgency: 'critical',
  });
  n.show();
  n.on('click', () => {
    win?.show();
    win?.focus();
  });
}
