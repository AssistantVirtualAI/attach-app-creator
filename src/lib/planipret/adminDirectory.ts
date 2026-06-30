import { supabase } from "@/integrations/supabase/client";

export type PlanipretBrokerRow = {
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  extension?: string | null;
  ns_extension?: string | null;
  mobile_app_enabled?: boolean | null;
  voice_agent_enabled?: boolean | null;
  ns_domain?: string | null;
  elevenlabs_agent_id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  dnd_enabled?: boolean | null;
  ns_only?: boolean;
  status?: string | null;
  maestro_connected?: boolean | null;
};

const extOf = (row: Partial<PlanipretBrokerRow>) => String(row.extension ?? row.ns_extension ?? "").trim();

export const isPlanipretActiveBroker = (row: Partial<PlanipretBrokerRow>) => {
  const email = String(row.email ?? "").trim();
  const status = String(row.status ?? "").toLowerCase();
  return !!extOf(row) && !/@lemtel\.com$/i.test(email) && !["disabled", "suspended", "deleted", "inactive"].includes(status);
};

export async function getPlanipretBrokerDirectory() {
  const { data: localProfiles } = await supabase
    .from("planipret_profiles")
    .select("*")
    .order("full_name", { ascending: true });

  const localList = ((localProfiles ?? []) as PlanipretBrokerRow[]).filter(isPlanipretActiveBroker);
  let nsDomain: string | null = null;
  let nsError: string | null = null;
  const debug: any[] = [{ label: "planipret_profiles", count: localList.length, sample: localList.slice(0, 3) }];

  try {
    const t0 = performance.now();
    const { data: nsRes, error: nsErr } = await supabase.functions.invoke("pp-ns-users", { body: {} });
    if (nsErr) throw new Error(nsErr.message);
    if ((nsRes as any)?.ok) {
      const nsBrokers = (((nsRes as any).brokers ?? []) as PlanipretBrokerRow[]).filter(isPlanipretActiveBroker);
      nsDomain = (nsRes as any).domain ?? null;
      debug.push({
        label: "pp-ns-users (source exacte Courtiers/KPI/sidebar)",
        count: Number((nsRes as any).count ?? nsBrokers.length),
        ms: Math.round(performance.now() - t0),
        meta: { domain: nsDomain, strategy: (nsRes as any).strategy, warning: (nsRes as any).warning ?? (nsRes as any).ns_warning },
        sample: nsBrokers.slice(0, 3),
      });

      const byExt = new Map<string, PlanipretBrokerRow>();
      nsBrokers.forEach((b) => byExt.set(extOf(b), b));
      localList.forEach((p) => {
        const ext = extOf(p);
        byExt.set(ext, { ...byExt.get(ext), ...p, extension: p.extension ?? p.ns_extension ?? byExt.get(ext)?.extension });
      });
      const merged = Array.from(byExt.values()).filter(isPlanipretActiveBroker)
        .sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || "")));
      return { brokers: merged, count: merged.length, nsDomain, nsError, debug };
    }
    if ((nsRes as any)?.error) nsError = (nsRes as any).error;
  } catch (e: any) {
    nsError = e?.message ?? "NS-API indisponible";
    debug.push({ label: "pp-ns-users", error: nsError });
  }

  return { brokers: localList, count: localList.length, nsDomain, nsError, debug };
}

export async function getPlanipretBrokerDirectoryCount() {
  return (await getPlanipretBrokerDirectory()).count;
}