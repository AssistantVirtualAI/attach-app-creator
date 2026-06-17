/**
 * /m — Mounts the real mobile app (apps/ava-softphone-mobile/src/MobileApp)
 * inside the web bundle so the MobilePreview iframe shows the live UI with
 * real Supabase data instead of a stub.
 *
 * Capacitor packages have web fallbacks: `Capacitor.isNativePlatform()` is
 * false in the browser, so native-only paths are skipped automatically.
 */
import MobileApp from '../../apps/ava-softphone-mobile/src/MobileApp';
import '../../apps/ava-softphone-mobile/src/styles.css';

export default function MobileEmbed() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A1429' }}>
      <MobileApp />
    </div>
  );
}
