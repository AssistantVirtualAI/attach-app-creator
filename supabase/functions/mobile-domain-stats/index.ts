// mobile-domain-stats: aggregated domain-wide stats for the mobile dashboard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const { data: sp } = await sb
      .from("pbx_softphone_users")
      .select("organization_id, extension")
      .eq("portal_user_id", u.user.id)
      .maybeSingle();
    if (!sp?.organization_id) return json({ error: "NO_SOFTPHONE_ACCOUNT" }, 404);

    const orgId = sp.organization_id;
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const since7 = new Date(Date.now() - 7 * 24 * 36e5); since7.setHours(0,0,0,0);

    const { data: todayRows } = await sb.from("pbx_call_records")
      .select("id, call_status, missed_call, duration_seconds, voicemail_message, extension")
      .eq("organization_id", orgId)
      .gte("start_at", startOfDay.toISOString());

    const callsToday = todayRows?.length ?? 0;
    const missedToday = (todayRows ?? []).filter((r: any) => r.missed_call || r.call_status === "missed").length;
    const voicemailsToday = (todayRows ?? []).filter((r: any) => !!r.voicemail_message || r.call_status === "voicemail").length;
    const answeredToday = callsToday - missedToday - voicemailsToday;
    const durations = (todayRows ?? []).map((r: any) => Number(r.duration_seconds || 0)).filter((n: number) => n > 0);
    const avgDurationSec = durations.length ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0;

    // Top extensions today
    const extMap: Record<string, number> = {};
    for (const r of (todayRows ?? [])) {
      const k = (r as any).extension; if (!k) continue;
      extMap[k] = (extMap[k] || 0) + 1;
    }
    const topExtNumbers = Object.entries(extMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const extNumberList = topExtNumbers.map(([n]) => n);
    let extNames: Record<string, string> = {};
    if (extNumberList.length) {
      const { data: exts } = await sb.from("pbx_extensions_safe")
        .select("extension, effective_cid_name")
        .eq("organization_id", orgId)
        .in("extension", extNumberList);
      for (const e of exts ?? []) extNames[(e as any).extension] = (e as any).effective_cid_name || "";
    }
    const topExtensions = topExtNumbers.map(([extension, calls]) => ({ extension, name: extNames[extension], calls }));

    // Last 7 days call counts
    const { data: weekRows } = await sb.from("pbx_call_records")
      .select("start_at")
      .eq("organization_id", orgId)
      .gte("start_at", since7.toISOString());
    const last7Days = Array(7).fill(0);
    for (const r of weekRows ?? []) {
      const d = new Date((r as any).start_at);
      const idx = 6 - Math.floor((Date.now() - d.getTime()) / (24 * 36e5));
      if (idx >= 0 && idx < 7) last7Days[idx]++;
    }

    // Active extensions: distinct extensions with any call in last 24h
    const activeExtensions = new Set((todayRows ?? []).map((r: any) => r.extension).filter(Boolean)).size;

    return json({
      callsToday, answeredToday, missedToday, voicemailsToday,
      avgDurationSec, activeExtensions, last7Days, topExtensions,
    });
  } catch (e: any) {
    return json({ error: e.message || "error" }, 500);
  }
});
