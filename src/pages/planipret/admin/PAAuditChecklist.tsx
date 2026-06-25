import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2, MinusCircle,
  RefreshCw, FileDown, ChevronDown, ChevronRight, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

type Status = "pass" | "fail" | "warn" | "skip" | "running";
type Item = { id: string; name: string; description?: string; status: Status; detail?: string; ms?: number };
type Section = { id: string; title: string; emoji: string; items: Item[] };
type Report = {
  ok: boolean;
  generated_at: string;
  score: number;
  totals: { pass: number; fail: number; warn: number; skip: number; total: number };
  sections: Section[];
};

// Manual / human-only checklist items (cannot be auto-tested).
const MANUAL_CHECKLIST: { id: string; label: string; hint: string }[] = [
  { id: "m-ns-webhook", label: "Webhook NS-API CDR enregistré dans voice.ava-telecom.ca",
    hint: "Portail NS → Settings → Webhooks → URL pointant vers /functions/v1/ns-webhook-receiver" },
  { id: "m-maestro-webhook", label: "Webhook Maestro configuré côté Kanguru",
    hint: "Webhooks sortants vers /functions/v1/maestro-webhook-receiver" },
  { id: "m-el-mic", label: "Agent ElevenLabs testé avec un vrai microphone",
    hint: "Tester sur /mplanipret avec un broker actif" },
  { id: "m-outbound", label: "Test appel sortant réel passé",
    hint: "Lancer un appel via le Dialer FAB et vérifier le CDR" },
  { id: "m-sms", label: "Test SMS envoyé et reçu",
    hint: "Envoyer un SMS via l'app et vérifier la réception" },
  { id: "m-voicemail", label: "Test boîte vocale générée et activée",
    hint: "Générer un greeting et vérifier sur l'extension NS" },
  { id: "m-m365", label: "Test M365 OAuth flow complet",
    hint: "Un broker connecte son compte Microsoft et vérifie emails/RDV" },
  { id: "m-admin", label: "Premier admin Planiprêt créé",
    hint: "Créer un compte admin dans /planipret/admin/users" },
  { id: "m-pipeline", label: "Test pipeline complet appel → analyse → Maestro",
    hint: "Appel 2+ min puis vérifier CDR, transcript, IA, coaching, Maestro" },
  { id: "m-resend", label: "SPF / DKIM Resend configuré",
    hint: "support@avastatistic.ca sur Resend" },
  { id: "m-ios", label: "Test sur iPhone Safari réel",
    hint: "Layout, micro, WebRTC, SIP" },
  { id: "m-android", label: "Test sur Android Chrome réel", hint: "Même vérification" },
  { id: "m-retention", label: "Politique de rétention définie",
    hint: "/planipret/admin/compliance" },
];

const C = {
  bg: "#030810",
  surface: "#0A1628",
  surfaceMuted: "#06122A",
  border: "#0E2A45",
  borderAccent: "rgba(46,155,220,0.25)",
  text: "#E8EDF5",
  textMuted: "#4A7FA5",
  textSecondary: "#94B4D4",
  pass: "#00D4AA",
  fail: "#E84C4C",
  warn: "#F5A623",
  info: "#2E9BDC",
  skip: "#2A4A6A",
};

function StatusIcon({ s }: { s: Status }) {
  if (s === "pass") return <CheckCircle2 className="w-4 h-4" style={{ color: C.pass }} />;
  if (s === "fail") return <XCircle className="w-4 h-4" style={{ color: C.fail }} />;
  if (s === "warn") return <AlertTriangle className="w-4 h-4" style={{ color: C.warn }} />;
  if (s === "running") return <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.info }} />;
  return <MinusCircle className="w-4 h-4" style={{ color: C.skip }} />;
}

function sectionScore(items: Item[]) {
  const testable = items.filter((i) => i.status !== "skip");
  if (testable.length === 0) return { pct: 0, pass: 0, total: 0 };
  const pass = testable.filter((i) => i.status === "pass").length;
  return { pct: Math.round((pass / testable.length) * 100), pass, total: testable.length };
}

function scoreColor(pct: number) {
  if (pct >= 90) return C.pass;
  if (pct >= 70) return C.warn;
  return C.fail;
}

function ScoreCircle({ pct }: { pct: number }) {
  const color = scoreColor(pct);
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: 120, height: 120,
        background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.06) 0)`,
      }}
    >
      <div
        className="absolute inset-[6px] rounded-full flex flex-col items-center justify-center"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        <div className="text-3xl font-bold" style={{ color: C.text, fontFamily: "Inter,sans-serif" }}>{pct}%</div>
        <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>Score global</div>
      </div>
    </div>
  );
}

export default function PAAuditChecklist() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [manualState, setManualState] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("pp-audit-manual") || "{}"); } catch { return {}; }
  });

  const runAudit = async () => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("pp-audit-runner", { body: {} });
      if (error) throw error;
      setReport(data as Report);
      sessionStorage.setItem("pp-audit-cache", JSON.stringify({ at: Date.now(), data }));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Hydrate from cache (5 min)
    try {
      const raw = sessionStorage.getItem("pp-audit-cache");
      if (raw) {
        const { at, data } = JSON.parse(raw);
        if (Date.now() - at < 5 * 60 * 1000) { setReport(data); return; }
      }
    } catch {/* ignore */}
    runAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleManual = (id: string) => {
    setManualState((s) => {
      const next = { ...s, [id]: !s[id] };
      localStorage.setItem("pp-audit-manual", JSON.stringify(next));
      return next;
    });
  };

  const ageMin = useMemo(() => {
    if (!report?.generated_at) return null;
    return Math.max(0, Math.round((Date.now() - new Date(report.generated_at).getTime()) / 60000));
  }, [report]);

  const exportPdf = async () => {
    if (!report) {
      toast.error("Aucun rapport à exporter");
      return;
    }
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      let y = margin;

      const line = (txt: string, size = 10, bold = false, color: [number, number, number] = [20, 20, 20]) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const wrapped = doc.splitTextToSize(String(txt ?? ""), pageW - margin * 2);
        for (const l of wrapped) {
          if (y > pageH - margin) { doc.addPage(); y = margin; }
          doc.text(l, margin, y);
          y += size * 1.25;
        }
      };
      const hr = () => {
        if (y > pageH - margin) { doc.addPage(); y = margin; }
        doc.setDrawColor(200); doc.line(margin, y, pageW - margin, y); y += 8;
      };

      line("Audit Systeme - Planipret AI Portal", 18, true, [10, 30, 60]);
      line(`Genere le ${new Date(report.generated_at).toLocaleString("fr-CA")}`, 9, false, [100, 100, 100]);
      y += 6;
      line(`Score global: ${report.score}%`, 14, true, [0, 100, 80]);
      line(`[OK] ${report.totals.pass}   [!] ${report.totals.warn}   [X] ${report.totals.fail}   [-] ${report.totals.skip}   (Total ${report.totals.total})`, 10);
      hr();

      const icon = (s: Status) => s === "pass" ? "[OK]" : s === "fail" ? "[X]" : s === "warn" ? "[!]" : s === "skip" ? "[-]" : "[..]";

      for (const sec of report.sections) {
        y += 4;
        line(`${sec.title}`, 13, true, [10, 30, 60]);
        for (const it of sec.items) {
          const color: [number, number, number] =
            it.status === "pass" ? [0, 130, 90] :
            it.status === "fail" ? [180, 40, 40] :
            it.status === "warn" ? [180, 120, 0] : [110, 110, 110];
          line(`${icon(it.status)} ${it.name}`, 10, true, color);
          if (it.detail) line(it.detail, 9, false, [80, 80, 80]);
        }
        hr();
      }

      line("Checklist manuelle", 13, true, [10, 30, 60]);
      for (const m of MANUAL_CHECKLIST) {
        const done = manualState[m.id];
        line(`${done ? "[X]" : "[ ]"} ${m.label}`, 10, true, done ? [0, 130, 90] : [60, 60, 60]);
        line(m.hint, 9, false, [110, 110, 110]);
      }

      const filename = `audit-planipret-${new Date().toISOString().slice(0, 10)}.pdf`;
      // Force a real download via blob + anchor (more reliable than doc.save across browsers)
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("PDF téléchargé");
    } catch (e: any) {
      console.error("[audit] exportPdf error", e);
      toast.error(`Échec export PDF: ${e?.message || e}`);
    }
  };

  return (
    <div className="min-h-full p-6 md:p-8" style={{ background: C.bg, color: C.text }}>
      {/* Header */}
      <div className="flex flex-col gap-2 mb-6">
        <h1 className="font-bold" style={{ fontFamily: "Inter,sans-serif", fontSize: 28, color: C.text }}>
          Audit Système — Planiprêt AI Portal
        </h1>
        <p style={{ fontFamily: "DM Sans,sans-serif", fontSize: 14, color: C.textMuted }}>
          Vérification complète de toutes les fonctionnalités et intégrations.
        </p>
      </div>

      {/* Score card */}
      <div
        className="rounded-2xl p-6 mb-6 flex flex-col md:flex-row items-center gap-6"
        style={{ background: C.surface, border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}
      >
        <div className="absolute inset-x-0 top-0 h-[2px]"
             style={{ background: "linear-gradient(90deg, transparent, #2E9BDC, #00D4AA, transparent)" }} />
        <ScoreCircle pct={report?.score ?? 0} />

        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
          <Kpi label="Complété" value={report?.totals.pass ?? 0} color={C.pass} icon="✅" />
          <Kpi label="Partiel" value={report?.totals.warn ?? 0} color={C.warn} icon="⚠️" />
          <Kpi label="Manquant" value={report?.totals.fail ?? 0} color={C.fail} icon="❌" />
          <Kpi label="Ignoré" value={report?.totals.skip ?? 0} color={C.skip} icon="⏭️" />
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <button
            onClick={runAudit}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition active:scale-95 disabled:opacity-60"
            style={{ background: "linear-gradient(90deg,#2E9BDC,#00D4AA)", color: "#03101A" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? "Audit en cours..." : "Relancer l'audit"}
          </button>
          <button
            onClick={exportPdf}
            className="px-4 py-2 rounded-xl text-xs flex items-center gap-2 border"
            style={{ borderColor: C.borderAccent, color: C.textSecondary, background: "transparent" }}
          >
            <FileDown className="w-3.5 h-3.5" /> Exporter rapport PDF
          </button>
          <div className="text-[11px]" style={{ color: C.textMuted }}>
            {ageMin == null ? "Pas encore exécuté" : `Dernier audit: il y a ${ageMin} min`}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", height: 8 }}>
        {report && (
          <div className="h-full transition-all"
               style={{ width: `${(report.totals.pass / (report.totals.total || 1)) * 100}%`,
                        background: `linear-gradient(90deg, ${C.pass}, ${C.info})` }} />
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl p-4 text-sm"
             style={{ background: "rgba(232,76,76,0.08)", border: `1px solid rgba(232,76,76,0.25)`, color: "#FFB4B4" }}>
          Erreur audit : {error}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {(report?.sections ?? []).map((sec) => {
          const score = sectionScore(sec.items);
          const isCollapsed = !!collapsed[sec.id];
          return (
            <div key={sec.id} className="rounded-2xl overflow-hidden"
                 style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [sec.id]: !c[sec.id] }))}
                className="w-full flex items-center justify-between gap-3 p-4 hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  {isCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: C.textMuted }} />
                               : <ChevronDown className="w-4 h-4" style={{ color: C.textMuted }} />}
                  <span className="text-xl">{sec.emoji}</span>
                  <span className="font-semibold" style={{ color: C.text }}>{sec.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.04)", color: C.textMuted }}>
                    {sec.items.length} items
                  </span>
                </div>
                <ScoreBadge pct={score.pct} pass={score.pass} total={score.total} />
              </button>

              {!isCollapsed && (
                <div className="border-t" style={{ borderColor: C.border }}>
                  {sec.items.map((item) => (
                    <div key={item.id}
                         className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0"
                         style={{ borderColor: "rgba(14,42,69,0.5)" }}>
                      <div className="mt-0.5"><StatusIcon s={item.status} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium" style={{ color: C.text }}>{item.name}</div>
                        {item.description && (
                          <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>{item.description}</div>
                        )}
                        {item.detail && (
                          <div className="text-xs mt-1"
                               style={{ color: item.status === "fail" ? "#FFB4B4"
                                              : item.status === "pass" ? "#7FE7CB"
                                              : item.status === "warn" ? "#FFD58A"
                                              : C.textMuted }}>
                            {item.detail}
                          </div>
                        )}
                      </div>
                      {item.ms != null && (
                        <div className="text-[11px] tabular-nums shrink-0" style={{ color: C.textMuted }}>{item.ms}ms</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Manual checklist */}
        <div className="rounded-2xl overflow-hidden"
             style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: C.border }}>
            <ShieldCheck className="w-5 h-5" style={{ color: C.info }} />
            <span className="font-semibold" style={{ color: C.text }}>Vérifications manuelles</span>
            <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.04)", color: C.textMuted }}>
              {Object.values(manualState).filter(Boolean).length}/{MANUAL_CHECKLIST.length}
            </span>
          </div>
          {MANUAL_CHECKLIST.map((m) => {
            const checked = !!manualState[m.id];
            return (
              <label key={m.id}
                     className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer hover:bg-white/[0.02]"
                     style={{ borderColor: "rgba(14,42,69,0.5)" }}>
                <input type="checkbox" checked={checked} onChange={() => toggleManual(m.id)}
                       className="mt-1 accent-cyan-500" />
                <div className="flex-1">
                  <div className="text-sm" style={{ color: checked ? C.textMuted : C.text,
                                                    textDecoration: checked ? "line-through" : undefined }}>
                    {m.label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: C.textMuted }}>{m.hint}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="rounded-xl p-3 flex items-center gap-3"
         style={{ background: "rgba(3,8,16,0.5)", border: `1px solid ${C.border}` }}>
      <div className="text-xl">{icon}</div>
      <div>
        <div className="text-lg font-bold tabular-nums" style={{ color }}>{value}</div>
        <div className="text-[10px] uppercase tracking-wider" style={{ color: C.textMuted }}>{label}</div>
      </div>
    </div>
  );
}

function ScoreBadge({ pct, pass, total }: { pct: number; pass: number; total: number }) {
  const color = pct === 100 ? C.pass : pct >= 80 ? C.info : pct >= 60 ? C.warn : C.fail;
  const label = pct === 100 ? "Parfait" : pct >= 80 ? "Excellent" : pct >= 60 ? "Attention" : "Action requise";
  return (
    <div className="flex items-center gap-2">
      <div className="text-xs font-semibold tabular-nums" style={{ color }}>{pass}/{total}</div>
      <div className="px-2 py-1 rounded-full text-[10px] uppercase tracking-wider"
           style={{ background: `${color}22`, color }}>{label}</div>
    </div>
  );
}
