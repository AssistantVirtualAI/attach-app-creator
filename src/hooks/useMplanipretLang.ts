import { useCallback, useEffect, useState } from "react";
import { MP_DICT, type MpLang, type MpDict } from "@/lib/i18n/mplanipret";

const KEY = "mplanipret-lang";

function detect(): MpLang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "fr" || v === "en") return v;
  } catch {}
  if (typeof navigator !== "undefined") {
    return (navigator.language || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
  }
  return "fr";
}

// Simple event-bus so all hook consumers stay in sync.
const listeners = new Set<(l: MpLang) => void>();
function emit(l: MpLang) { listeners.forEach((fn) => fn(l)); }

export function useMplanipretLang() {
  const [lang, setLangState] = useState<MpLang>(detect);

  useEffect(() => {
    const fn = (l: MpLang) => setLangState(l);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const setLang = useCallback((l: MpLang) => {
    try { localStorage.setItem(KEY, l); } catch {}
    emit(l);
  }, []);

  const toggle = useCallback(() => setLang(lang === "fr" ? "en" : "fr"), [lang, setLang]);

  const t = useCallback(
    (path: string): string => {
      const dict = MP_DICT[lang] as unknown as Record<string, any>;
      const v = path.split(".").reduce<any>((acc, k) => (acc ? acc[k] : undefined), dict);
      return typeof v === "string" ? v : path;
    },
    [lang]
  );

  return { lang, setLang, toggle, t, dict: MP_DICT[lang] as MpDict };
}
