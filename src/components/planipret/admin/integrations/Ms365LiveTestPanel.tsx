/**
 * Live Microsoft 365 connection test panel.
 * Invokes the `ms365-connection-test` Edge Function and renders the results.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";

type TestResult = {
  success: boolean;
  message?: string;
  [k: string]: any;
};

type Response = {
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    tested_at: string;
    elapsed_ms: number;
    tenant_id?: string | null;
    client_id?: string | null;
  };
  results: Record<string, TestResult>;
};

const LABELS: Record<string, string> = {
  auth: "Authentification OAuth2",
  organization: "Organisation Microsoft",
  users: "Utilisateurs Microsoft",
  app_registration: "Configuration App Azure",
  permissions: "Permissions Graph",
  config: "Configuration",
};

export default function Ms365LiveTestPanel() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Response | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL ?? "";
  const expectedCallback = `${supabaseUrl}/functions/v1/ms365-oauth-callback`;

  async function runTest() {
    setLoading(true);
    setData(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("ms365-connection-test", {
        body: {},
      });
      if (error) throw error;
      setData(res as Response);
    } catch (e: any) {
      toast.error("Erreur test MS365: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  const rows = data ? Object.entries(data.results) : [];

  return (
    <div
      className="rounded-lg p-3 mt-4"
      style={{ background: "#0A1628", border: "1px solid #0E2A45" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontSize: 12, fontWeight: 700, color: "#E8EDF5" }}>
          🔬 Test en direct
        </div>
        {data && (
          <div className="flex items-center gap-2 text-[11px]" style={{ color: "#4A7FA5" }}>
            <span
              className="px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: data.summary.failed === 0 ? "rgba(46,220,120,0.12)" : "rgba(232,76,76,0.12)",
                border: `1px solid ${data.summary.failed === 0 ? "#1a6b3a" : "#5A1010"}`,
                color: data.summary.failed === 0 ? "#2EDC78" : "#E84C4C",
              }}
            >
              ✅ {data.summary.passed}/{data.summary.total_tests} tests réussis
            </span>
            <span>⏱ {data.summary.elapsed_ms}ms</span>
            <span>Testé le: {new Date(data.summary.tested_at).toLocaleString("fr-CA")}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={runTest}
        disabled={loading}
        className="inline-flex items-center gap-2 disabled:opacity-60"
        style={{
          background: "#0078D4",
          color: "white",
          borderRadius: 10,
          padding: "10px 20px",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connexion à Microsoft Azure...
          </>
        ) : (
          <>▶ Tester la connexion Microsoft</>
        )}
      </button>

      {rows.length > 0 && (
        <div className="mt-4 space-y-2">
          {rows.map(([key, r]) => {
            const open = !!expanded[key];
            const icon = r.success ? "✅" : "❌";
            return (
              <div
                key={key}
                className="rounded-lg"
                style={{ background: "#0D1F35", border: "1px solid #0E2A45" }}
              >
                <button
                  type="button"
                  onClick={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}
                  className="w-full flex items-center gap-2 p-2.5 text-left"
                >
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#E8EDF5", minWidth: 160 }}>
                    {LABELS[key] ?? key}
                  </span>
                  <span style={{ fontSize: 12, color: "#8FA8C0", flex: 1 }}>
                    {r.message ?? (r.success ? "OK" : "Erreur")}
                  </span>
                  {open ? (
                    <ChevronDown className="w-4 h-4" style={{ color: "#4A7FA5" }} />
                  ) : (
                    <ChevronRight className="w-4 h-4" style={{ color: "#4A7FA5" }} />
                  )}
                </button>
                {open && (
                  <div className="px-3 pb-3">
                    <pre
                      className="rounded p-2 overflow-x-auto"
                      style={{
                        background: "#040B16",
                        border: "1px solid #0E2A45",
                        color: "#8FA8C0",
                        fontSize: 11,
                        lineHeight: 1.5,
                      }}
                    >
                      {JSON.stringify(r, null, 2)}
                    </pre>
                    {key === "app_registration" && r.success && expectedCallback && (
                      <RedirectCheck result={r} expected={expectedCallback} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RedirectCheck({ result, expected }: { result: TestResult; expected: string }) {
  const all: string[] = [
    ...(result.redirect_uris_web ?? []),
    ...(result.redirect_uris_spa ?? []),
    ...(result.redirect_uris_public ?? []),
  ];
  const found = all.some((u) => u === expected);
  if (found) {
    return (
      <div
        className="mt-2 p-2 rounded text-[11px]"
        style={{ background: "rgba(46,220,120,0.08)", border: "1px solid #1a6b3a", color: "#2EDC78" }}
      >
        ✅ Redirect URI Supabase configurée dans Azure
      </div>
    );
  }
  return (
    <div
      className="mt-2 p-2 rounded text-[11px] flex items-center gap-2"
      style={{ background: "rgba(245,166,35,0.08)", border: "1px solid #4A3000", color: "#F5A623" }}
    >
      <span>⚠️ Redirect URI Supabase manquante — ajouter dans Azure:</span>
      <code
        style={{ background: "#040B16", padding: "2px 6px", borderRadius: 4, color: "#E8EDF5" }}
      >
        {expected}
      </code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(expected);
          toast.success("URI copiée");
        }}
        className="inline-flex items-center gap-1 px-2 py-1 rounded"
        style={{ background: "#0D1F35", border: "1px solid #0E2A45", color: "#2E9BDC" }}
      >
        <Copy className="w-3 h-3" />
        Copier
      </button>
    </div>
  );
}
