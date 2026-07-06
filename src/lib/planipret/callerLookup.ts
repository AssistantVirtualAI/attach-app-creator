// Resolves caller names via the pp-caller-lookup edge function (device contacts,
// Maestro CRM, org brokers, Microsoft 365). Results are cached in-memory for
// the session so repeated renders don't re-query.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();
const negative = new Set<string>();
const inflight = new Map<string, Promise<string | null>>();

export async function lookupCaller(phone: string | null | undefined): Promise<string | null> {
  const p = (phone || "").trim();
  if (!p) return null;
  if (cache.has(p)) return cache.get(p) || null;
  if (negative.has(p)) return null;
  if (inflight.has(p)) return inflight.get(p)!;

  const promise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("pp-caller-lookup", { body: { phone: p } });
      if (error) {
        console.warn("[lookupCaller] error", p, error.message);
        negative.add(p);
        return null;
      }
      const d = data as any;
      if (d?.found && d?.name) {
        cache.set(p, d.name);
        return d.name as string;
      }
      negative.add(p);
      return null;
    } catch (e: any) {
      console.warn("[lookupCaller] threw", p, e?.message);
      negative.add(p);
      return null;
    } finally {
      inflight.delete(p);
    }
  })();
  inflight.set(p, promise);
  return promise;
}

/**
 * Hook: given a list of phone numbers, returns a { [phone]: name } map that
 * fills in progressively as pp-caller-lookup returns names.
 */
export function useCallerNames(phones: (string | null | undefined)[]): Record<string, string> {
  const key = phones.filter(Boolean).join("|");
  const [names, setNames] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const p of phones) {
      if (p && cache.has(p)) seed[p] = cache.get(p)!;
    }
    return seed;
  });

  useEffect(() => {
    let alive = true;
    const uniq = Array.from(new Set(phones.filter((x): x is string => !!x && x.trim().length > 0)));

    // Seed cache hits synchronously
    const seeded: Record<string, string> = {};
    uniq.forEach((p) => { const c = cache.get(p); if (c) seeded[p] = c; });
    if (Object.keys(seeded).length) setNames((prev) => ({ ...seeded, ...prev }));

    uniq.forEach((p) => {
      if (cache.has(p) || negative.has(p)) return;
      lookupCaller(p).then((name) => {
        if (!alive || !name) return;
        setNames((prev) => (prev[p] === name ? prev : { ...prev, [p]: name }));
      });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return names;
}
