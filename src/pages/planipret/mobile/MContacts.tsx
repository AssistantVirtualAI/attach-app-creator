import { useState, useMemo, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { Search, Phone, MessageSquare, Mail, Users, Smartphone, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PlanipretMobileContext } from "../PlanipretMobile";

type Tab = "maestro" | "phone" | "recents";

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "?";
  const hue = (name.charCodeAt(0) * 17) % 360;
  return (
    <div
      className="flex items-center justify-center font-bold text-white"
      style={{
        width: 40, height: 40, borderRadius: "50%",
        background: `linear-gradient(135deg, hsl(${hue},60%,30%), hsl(${(hue + 40) % 360},70%,45%))`,
        fontSize: 13, fontFamily: "Inter, sans-serif",
      }}
    >{initials}</div>
  );
}

export default function MContacts() {
  const { openDialer } = useOutletContext<PlanipretMobileContext>();
  const [tab, setTab] = useState<Tab>("maestro");
  const [q, setQ] = useState("");
  const [maestroContacts, setMaestroContacts] = useState<any[]>([]);
  const [recents, setRecents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        if (tab === "maestro") {
          const { data } = await supabase
            .from("planipret_contacts")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(50);
          if (!cancel) setMaestroContacts(data ?? []);
        } else if (tab === "recents") {
          const { data } = await supabase
            .from("planipret_phone_calls")
            .select("id, from_number, to_number, direction, started_at, contact_name")
            .order("started_at", { ascending: false })
            .limit(30);
          if (!cancel) setRecents(data ?? []);
        }
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [tab]);

  const list = useMemo(() => {
    if (tab === "maestro") {
      return maestroContacts.filter((c) => {
        if (!q) return true;
        const hay = `${c.first_name ?? ""} ${c.last_name ?? ""} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      });
    }
    if (tab === "recents") {
      const seen = new Set<string>();
      const dedup: any[] = [];
      for (const r of recents) {
        const key = r.direction === "inbound" ? r.from_number : r.to_number;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        dedup.push({ id: r.id, name: r.contact_name ?? key, number: key, time: r.started_at });
      }
      return dedup;
    }
    return [];
  }, [tab, maestroContacts, recents, q]);

  return (
    <div className="p-4 pb-2">
      <h1 style={{ fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 22, color: "var(--pp-text-primary)", marginBottom: 12 }}>
        Contacts
      </h1>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 mb-4"
        style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)", borderRadius: 14, height: 44 }}>
        <Search className="w-4 h-4" style={{ color: "var(--pp-text-faint)" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un contact…"
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: "var(--pp-text-primary)", fontFamily: "DM Sans, sans-serif" }}
        />
      </div>

      {/* Pill tabs */}
      <div className="flex gap-1 p-1 mb-4" style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)", borderRadius: 12 }}>
        {([
          { id: "maestro", label: "Maestro CRM", Icon: Users },
          { id: "phone", label: "Téléphone", Icon: Smartphone },
          { id: "recents", label: "Récents", Icon: Clock },
        ] as const).map((p) => {
          const active = tab === p.id;
          return (
            <button key={p.id} onClick={() => setTab(p.id)}
              className="flex-1 flex items-center justify-center gap-1.5 transition"
              style={{
                padding: "8px 10px",
                borderRadius: 9,
                background: active ? "var(--pp-brand-accent-2)" : "transparent",
                border: active ? "1px solid var(--pp-brand-accent)" : "1px solid transparent",
                color: active ? "#fff" : "var(--pp-text-muted)",
                fontFamily: "DM Sans, sans-serif", fontWeight: 600, fontSize: 11,
              }}>
              <p.Icon className="w-3.5 h-3.5" />{p.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading && <div className="text-center py-8 text-sm" style={{ color: "var(--pp-text-muted)" }}>Chargement…</div>}

      {!loading && tab === "maestro" && list.length === 0 && (
        <div className="text-center py-8 pp-card" style={{ padding: 32 }}>
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--pp-text-faint)" }} />
          <div style={{ color: "var(--pp-text-secondary)", fontSize: 13 }}>Aucun contact Maestro</div>
        </div>
      )}

      {!loading && tab === "phone" && (
        <div className="text-center py-8 pp-card" style={{ padding: 32 }}>
          <Smartphone className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--pp-text-faint)" }} />
          <div style={{ color: "var(--pp-text-secondary)", fontSize: 13, marginBottom: 12 }}>
            Accès aux contacts du téléphone
          </div>
          <div style={{ color: "var(--pp-text-muted)", fontSize: 11 }}>
            Disponible dans l'app native (iOS / Android)
          </div>
        </div>
      )}

      {!loading && (tab === "maestro" || tab === "recents") && list.length > 0 && (
        <div className="space-y-2">
          {list.map((c: any) => {
            const name = tab === "maestro" ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.phone : c.name;
            const sub = tab === "maestro" ? (c.phone ?? c.email ?? "") : c.number;
            const phone = tab === "maestro" ? c.phone : c.number;
            return (
              <div key={c.id} className="pp-card flex items-center gap-3" style={{ padding: 12 }}>
                <Avatar name={name || "?"} />
                <div className="flex-1 min-w-0">
                  <div style={{ fontFamily: "Inter,sans-serif", fontWeight: 600, fontSize: 14, color: "var(--pp-text-primary)" }}
                    className="truncate">{name || "Sans nom"}</div>
                  <div style={{ fontFamily: "DM Sans,sans-serif", fontSize: 11, color: "var(--pp-text-muted)" }}
                    className="truncate">{sub}</div>
                </div>
                <button onClick={() => phone && openDialer(phone)}
                  className="flex items-center justify-center active:scale-95 transition"
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(46,155,220,0.12)", border: "1px solid rgba(46,155,220,0.3)", color: "var(--pp-brand-accent)" }}
                  aria-label="Appeler">
                  <Phone className="w-3.5 h-3.5" />
                </button>
                {tab === "maestro" && (
                  <>
                    <button className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
