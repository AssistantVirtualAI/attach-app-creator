/**
 * Planiprêt — First-launch permissions onboarding (5 swipeable screens).
 * Triggers Capacitor native permission prompts when available, falls back to
 * web equivalents in the preview. Marks `pp_perm_onboarding_done` in localStorage.
 */
import { useState } from "react";
import { Mic, Bell, Users, Headphones, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import planipretLogo from "@/assets/planipret-logo.png.asset.json";
import { useMplanipretLang } from "@/hooks/useMplanipretLang";

const KEY = "pp_perm_onboarding_done";
export const isPermOnboardingDone = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return true; }
};
export const markPermOnboardingDone = () => {
  try { localStorage.setItem(KEY, "1"); } catch {}
};

type Screen = {
  icon: React.ReactNode;
  titleFr: string; titleEn: string;
  descFr: string;  descEn: string;
  ctaFr: string;   ctaEn: string;
  skippable?: boolean;
  action?: () => Promise<void>;
};

async function reqMic() {
  try {
    // @ts-ignore optional native plugin
    const { Microphone } = await import(/* @vite-ignore */ "@capacitor-community/microphone").catch(() => ({}));
    if (Microphone?.requestPermissions) { await Microphone.requestPermissions(); return; }
  } catch {}
  try { await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop())); }
  catch (e: any) { throw new Error(e?.message ?? "Microphone denied"); }
}
async function reqPush() {
  try {
    // @ts-ignore
    const { PushNotifications } = await import(/* @vite-ignore */ "@capacitor/push-notifications").catch(() => ({}));
    if (PushNotifications?.requestPermissions) { await PushNotifications.requestPermissions(); return; }
  } catch {}
  if ("Notification" in window) await Notification.requestPermission();
}
async function reqContacts() {
  try {
    // @ts-ignore
    const { Contacts } = await import(/* @vite-ignore */ "@capacitor-community/contacts").catch(() => ({}));
    if (Contacts?.requestPermissions) { await Contacts.requestPermissions(); return; }
  } catch {}
  // Web has no contacts API in most browsers — silently no-op.
}
async function reqBluetooth() {
  try {
    // Web Bluetooth (Chrome/Edge); iOS Safari has no equivalent.
    const bt = (navigator as any).bluetooth;
    if (bt?.requestDevice) {
      await bt.requestDevice({ acceptAllDevices: true }).catch(() => {});
    }
  } catch {}
}

export default function MobilePermissionsOnboarding({ onDone }: { onDone: () => void }) {
  const { lang } = useMplanipretLang();
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);

  const screens: Screen[] = [
    { icon: <img src={planipretLogo.url} alt="" className="w-24 h-24 rounded-3xl object-cover" />,
      titleFr: "Bienvenue sur Planiprêt Mobile", titleEn: "Welcome to Planiprêt Mobile",
      descFr: "Votre bureau téléphonique dans votre poche.", descEn: "Your phone office in your pocket.",
      ctaFr: "Commencer", ctaEn: "Get started" },
    { icon: <Mic className="w-20 h-20" style={{ color: "var(--pp-brand-accent)" }} />,
      titleFr: "Accès au microphone", titleEn: "Microphone access",
      descFr: "Pour passer et recevoir des appels téléphoniques via votre extension professionnelle.",
      descEn: "To place and receive calls through your business extension.",
      ctaFr: "Autoriser le microphone", ctaEn: "Allow microphone", action: reqMic },
    { icon: <Bell className="w-20 h-20" style={{ color: "var(--pp-brand-accent)" }} />,
      titleFr: "Notifications d'appels", titleEn: "Call notifications",
      descFr: "Recevez vos appels, messages et voicemails même quand l'app est fermée.",
      descEn: "Receive calls, messages and voicemails even when the app is closed.",
      ctaFr: "Activer les notifications", ctaEn: "Enable notifications", action: reqPush },
    { icon: <Users className="w-20 h-20" style={{ color: "var(--pp-brand-accent)" }} />,
      titleFr: "Accès aux contacts", titleEn: "Contacts access",
      descFr: "Identifiez vos appelants et appelez directement depuis vos contacts.",
      descEn: "Identify callers and dial straight from your contacts.",
      ctaFr: "Autoriser les contacts", ctaEn: "Allow contacts", action: reqContacts, skippable: true },
    { icon: <Headphones className="w-20 h-20" style={{ color: "var(--pp-brand-accent)" }} />,
      titleFr: "Appareils Bluetooth", titleEn: "Bluetooth devices",
      descFr: "Utilisez votre casque Bluetooth pour vos appels professionnels.",
      descEn: "Use your Bluetooth headset for business calls.",
      ctaFr: "Connecter Bluetooth", ctaEn: "Connect Bluetooth", action: reqBluetooth, skippable: true },
  ];

  const s = screens[i];
  const last = i === screens.length - 1;

  const finish = () => { markPermOnboardingDone(); onDone(); };

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try { if (s.action) await s.action(); }
    catch (e: any) { toast.error(e?.message ?? "Permission refusée"); }
    setBusy(false);
    if (last) finish(); else setI(i + 1);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--pp-bg-base)" }}>
      {/* Skip / close */}
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex gap-1">
          {screens.map((_, n) => (
            <div key={n} className="h-1 rounded-full transition-all"
              style={{ width: n === i ? 22 : 8, background: n <= i ? "var(--pp-brand-accent)" : "var(--pp-bg-border-2)" }} />
          ))}
        </div>
        <button onClick={finish} aria-label="Fermer"
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "var(--pp-bg-elevated)", color: "var(--pp-text-secondary)" }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="mb-8 flex items-center justify-center" style={{ minHeight: 120 }}>
          {s.icon}
        </div>
        <h2 style={{ fontFamily: "Urbanist,sans-serif", fontWeight: 700, fontSize: 22, color: "var(--pp-text-primary)", marginBottom: 10 }}>
          {lang === "fr" ? s.titleFr : s.titleEn}
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--pp-text-secondary)", maxWidth: 340 }}>
          {lang === "fr" ? s.descFr : s.descEn}
        </p>
      </div>

      <div className="px-6 pb-8 space-y-3">
        <button onClick={run} disabled={busy}
          className="w-full rounded-xl py-3.5 font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #1A4A8A, #2E9BDC)", boxShadow: "0 6px 22px rgba(46,155,220,0.40)", fontSize: 14 }}>
          {lang === "fr" ? s.ctaFr : s.ctaEn} <ChevronRight className="w-4 h-4" />
        </button>
        {s.skippable && !last && (
          <button onClick={() => setI(i + 1)} className="w-full py-2 text-[13px] font-semibold"
            style={{ color: "var(--pp-text-muted)" }}>
            {lang === "fr" ? "Passer pour l'instant" : "Skip for now"}
          </button>
        )}
        {s.skippable && last && (
          <button onClick={finish} className="w-full py-2 text-[13px] font-semibold"
            style={{ color: "var(--pp-text-muted)" }}>
            {lang === "fr" ? "Passer pour l'instant" : "Skip for now"}
          </button>
        )}
      </div>
    </div>
  );
}
