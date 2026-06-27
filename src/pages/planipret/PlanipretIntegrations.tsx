/**
 * Planiprêt Integrations admin page.
 *
 * Single source of truth for integration credentials and toggles.
 * Saving a card calls `pp-save-integration`; testing calls `pp-test-integration`.
 * The mobile app reads `planipret_integration_config` via Supabase Realtime
 * (see `src/services/IntegrationSync.ts`).
 *
 * Batch 1 (this file): foundation + NS-API + Claude IA cards.
 * Batch 2/3: Microsoft 365, ElevenLabs, Maestro, Webhooks, Mobile App, Compliance.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  IntegrationCard, IntegrationStatus, Field, TextInput, SecretInput,
  InfoBanner, CopyButton,
} from "@/components/planipret/admin/integrations/IntegrationCard";

type Row = {
  integration_key: string;
  is_enabled: boolean;
  is_configured: boolean;
  config_data: Record<string, string>;
  last_tested_at: string | null;
  last_test_result: string | null;
  last_test_success: boolean | null;
};



function deriveStatus(row?: Row): IntegrationStatus {
  if (!row) return "unconfigured";
  if (!row.is_configured) return "unconfigured";
  if (row.last_test_success === false) return "error";
  if (row.last_test_success === true) return "connected";
  return "pending";
}

export default function PlanipretIntegrations() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(true);

  // Per-card editable state (uncommitted form values)
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});

  async function refresh() {
    const { data, error } = await supabase
      .from("planipret_integration_config")
      .select("integration_key,is_enabled,is_configured,config_data,last_tested_at,last_test_result,last_test_success");
    if (error) { toast.error("Chargement impossible: " + error.message); setLoading(false); return; }
    const map: Record<string, Row> = {};
    (data ?? []).forEach((r: any) => { map[r.integration_key] = r as Row; });
    setRows(map);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("pp-integration-config")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "planipret_integration_config" },
        () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Health pills
  const health = useMemo(() => {
    const list = Object.values(rows);
    return {
      connected: list.filter((r) => deriveStatus(r) === "connected").length,
      pending:   list.filter((r) => deriveStatus(r) === "pending" || deriveStatus(r) === "unconfigured").length,
      errors:    list.filter((r) => deriveStatus(r) === "error").length,
    };
  }, [rows]);

  function getField(key: string, field: string, fallback = "") {
    return draft[key]?.[field] ?? rows[key]?.config_data?.[field] ?? fallback;
  }
  function setField(key: string, field: string, value: string) {
    setDraft((d) => ({ ...d, [key]: { ...(d[key] ?? {}), [field]: value } }));
  }

  async function save(key: string, requiredFields: string[]) {
    const cfg = { ...(rows[key]?.config_data ?? {}), ...(draft[key] ?? {}) };
    for (const f of requiredFields) {
      if (!cfg[f]) { toast.error(`Champ requis: ${f}`); return; }
    }
    const { data, error } = await supabase.functions.invoke("pp-save-integration", {
      body: { integration_key: key, config: draft[key] ?? {} },
    });
    if (error || (data && (data as any).error)) {
      toast.error(`Échec: ${(data as any)?.error ?? error?.message}`);
      return;
    }
    toast.success("✅ Intégration sauvegardée et synchronisée");
    setDraft((d) => ({ ...d, [key]: {} }));
    refresh();
  }

  async function toggleEnabled(key: string, next: boolean) {
    const { error } = await supabase.functions.invoke("pp-save-integration", {
      body: { integration_key: key, is_enabled: next },
    });
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Activée" : "Désactivée");
    refresh();
  }

  async function test(key: string) {
    const { data, error } = await supabase.functions.invoke("pp-test-integration", {
      body: { integration_key: key },
    });
    if (error) { toast.error(error.message); return; }
    const ok = (data as any)?.success;
    const msg = (data as any)?.message ?? "—";
    if (ok) toast.success(`✅ ${msg}`); else toast.error(`❌ ${msg}`);
    refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: "#4A7FA5" }}>
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement des intégrations…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header strip */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p style={{ fontSize: 13, color: "#4A7FA5", maxWidth: 720 }}>
            Configurez vos intégrations une seule fois — elles se synchronisent automatiquement
            avec l'application mobile pour les 350 courtiers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HealthPill color="#00D4AA" bg="#0D3D2A" border="#1A5A3F" label={`${health.connected} connectées`} />
          <HealthPill color="#F5A623" bg="#2A1A00" border="#4A3000" label={`${health.pending} en attente`} />
          <HealthPill color="#E84C4C" bg="#3D1010" border="#5A1A1A" label={`${health.errors} erreurs`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ───────── CARD 2 — NS-API ───────── */}
        <IntegrationCard
          integrationKey="ns_api" name="NS-API (NetSapiens)"
          description="Système téléphonique — appels, CDRs, voicemails, SMS, enregistrements"
          emoji="📞"
          status={deriveStatus(rows.ns_api)}
          enabled={rows.ns_api?.is_enabled ?? false}
          lastTestedAt={rows.ns_api?.last_tested_at}
          lastTestResult={rows.ns_api?.last_test_result}
          lastTestSuccess={rows.ns_api?.last_test_success}
          onToggleEnabled={(v) => toggleEnabled("ns_api", v)}
          onSave={() => save("ns_api", ["base_url", "api_key", "domain"])}
          onTest={() => test("ns_api")}
        >
          <InfoBanner>
            Obtenez votre API Key depuis le portail NetSapiens : <code>voice.ava-telecom.ca/portal → Apps → API Keys → Create New Key</code>
            <div className="mt-2">
              <a href="https://voice.ava-telecom.ca/portal" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "#0D1F35", border: "1px solid #0E2A45", color: "#2E9BDC" }}>
                Ouvrir le portail NS →
              </a>
            </div>
          </InfoBanner>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Serveur NS-API (Base URL)" required>
              <TextInput value={getField("ns_api", "base_url", "https://voice.ava-telecom.ca/ns-api/v2")}
                onChange={(e) => setField("ns_api", "base_url", e.target.value)}
                placeholder="https://voice.ava-telecom.ca/ns-api/v2" />
            </Field>
            <Field label="API Key" required hint="Format: nsr_XXXXXXXXXX — fournie par Keeny">
              <SecretInput value={draft.ns_api?.api_key ?? ""}
                onChange={(v) => setField("ns_api", "api_key", v)}
                hasSavedValue={!!rows.ns_api?.config_data?.api_key}
                placeholder="nsr_••••••••••••••••••••••••••••••••" />
            </Field>
            <Field label="Domaine par défaut" required>
              <TextInput value={getField("ns_api", "domain", "planipret.ca")}
                onChange={(e) => setField("ns_api", "domain", e.target.value)}
                placeholder="planipret.ca" />
            </Field>
            <Field label="Domaine de fallback (sandbox)" hint="Utilisé pour les tests — ns-api.com">
              <TextInput value={getField("ns_api", "fallback_domain", "")}
                onChange={(e) => setField("ns_api", "fallback_domain", e.target.value)}
                placeholder="mhassoun.assistantvirtualai.com" />
            </Field>
          </div>
        </IntegrationCard>

        {/* ───────── CARD 5 — CLAUDE IA ───────── */}
        <IntegrationCard
          integrationKey="anthropic" name="Claude IA (Anthropic)"
          description="Analyse des appels, coaching IA, résumés, scoring des leads"
          emoji="🤖"
          status={deriveStatus(rows.anthropic)}
          enabled={rows.anthropic?.is_enabled ?? false}
          lastTestedAt={rows.anthropic?.last_tested_at}
          lastTestResult={rows.anthropic?.last_test_result}
          lastTestSuccess={rows.anthropic?.last_test_success}
          onToggleEnabled={(v) => toggleEnabled("anthropic", v)}
          onSave={() => save("anthropic", ["api_key"])}
          onTest={() => test("anthropic")}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Anthropic API Key" required hint="console.anthropic.com → API Keys">
              <SecretInput value={draft.anthropic?.api_key ?? ""}
                onChange={(v) => setField("anthropic", "api_key", v)}
                hasSavedValue={!!rows.anthropic?.config_data?.api_key}
                placeholder="sk-ant-••••••••••••••••••••••••" />
            </Field>
            <Field label="Modèle IA" hint="claude-sonnet-4-5 recommandé (rapide & intelligent)">
              <select
                value={getField("anthropic", "model", "claude-sonnet-4-5")}
                onChange={(e) => setField("anthropic", "model", e.target.value)}
                style={{ background: "#0D1F35", border: "1px solid #0E2A45", borderRadius: 10, padding: "10px 14px", color: "#E8EDF5", fontSize: 13, width: "100%", outline: "none" }}>
                <option value="claude-sonnet-4-5">claude-sonnet-4-5 (recommandé)</option>
                <option value="claude-opus-4-1">claude-opus-4-1 (analyses complexes)</option>
                <option value="claude-haiku-4-5">claude-haiku-4-5 (économique)</option>
              </select>
            </Field>
            <Field label="Température" hint="0 = précis · 1 = créatif">
              <TextInput type="number" step="0.1" min={0} max={1}
                value={getField("anthropic", "temperature", "0.7")}
                onChange={(e) => setField("anthropic", "temperature", e.target.value)} />
            </Field>
            <Field label="Tokens max par analyse" hint="500 – 4000">
              <TextInput type="number" min={500} max={4000}
                value={getField("anthropic", "max_tokens", "1000")}
                onChange={(e) => setField("anthropic", "max_tokens", e.target.value)} />
            </Field>
          </div>
          <div className="mt-3">
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "#0D1F35", border: "1px solid #0E2A45", color: "#2E9BDC" }}>
              Ouvrir Anthropic Console →
            </a>
          </div>
        </IntegrationCard>

        {/* ───────── CARD 1 — MICROSOFT 365 ───────── */}
        <IntegrationCard
          integrationKey="ms365" name="Microsoft 365"
          description="Outlook Email · Calendar · Teams Chat · OneDrive"
          emoji="🔵" fullWidth
          status={deriveStatus(rows.ms365)}
          enabled={rows.ms365?.is_enabled ?? false}
          lastTestedAt={rows.ms365?.last_tested_at}
          lastTestResult={rows.ms365?.last_test_result}
          lastTestSuccess={rows.ms365?.last_test_success}
          onToggleEnabled={(v) => toggleEnabled("ms365", v)}
          onSave={() => save("ms365", ["tenant_id", "client_id", "client_secret"])}
          onTest={() => test("ms365")}
        >
          <InfoBanner>
            Créez une App Registration dans Azure AD pour <strong>planipret.ca</strong>.
            Permissions requises (Application): <code>Mail.ReadWrite</code>, <code>Mail.Send</code>,
            <code>Calendars.ReadWrite</code>, <code>Chat.ReadWrite</code>, <code>Files.ReadWrite.All</code>, <code>User.Read.All</code>.
            <div className="mt-2 flex items-center gap-2">
              <a href="https://portal.azure.com" target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "#0D1F35", border: "1px solid #0E2A45", color: "#2E9BDC" }}>
                Ouvrir Azure Portal →
              </a>
              <CopyButton value={`${window.location.origin}/auth/ms365/callback`} label="Copier Redirect URI" />
            </div>
          </InfoBanner>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Tenant ID" required hint="Azure AD → Overview → Directory (tenant) ID">
              <TextInput value={getField("ms365", "tenant_id")}
                onChange={(e) => setField("ms365", "tenant_id", e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000" />
            </Field>
            <Field label="Client ID (Application ID)" required>
              <TextInput value={getField("ms365", "client_id")}
                onChange={(e) => setField("ms365", "client_id", e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000" />
            </Field>
            <Field label="Client Secret" required hint="Certificates & secrets → New client secret">
              <SecretInput value={draft.ms365?.client_secret ?? ""}
                onChange={(v) => setField("ms365", "client_secret", v)}
                hasSavedValue={!!rows.ms365?.config_data?.client_secret} />
            </Field>
            <Field label="Redirect URI" hint="À copier exactement dans Azure Portal">
              <TextInput readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/ms365/callback`} />
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            {[
              { k: "scope_mail",     label: "📧 Outlook Mail" },
              { k: "scope_calendar", label: "📅 Calendar" },
              { k: "scope_teams",    label: "💬 Teams Chat" },
              { k: "scope_onedrive", label: "📁 OneDrive" },
            ].map((s) => {
              const on = getField("ms365", s.k, "true") === "true";
              return (
                <button key={s.k} type="button"
                  onClick={() => setField("ms365", s.k, on ? "false" : "true")}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-left"
                  style={{
                    background: on ? "rgba(46,155,220,0.1)" : "#0D1F35",
                    border: `1px solid ${on ? "#2E9BDC" : "#0E2A45"}`,
                    color: on ? "#2E9BDC" : "#8FA8C0",
                  }}>
                  {on ? "✓ " : ""}{s.label}
                </button>
              );
            })}
          </div>
        </IntegrationCard>

        {/* ───────── CARD 4 — ELEVENLABS ───────── */}
        <IntegrationCard
          integrationKey="elevenlabs" name="ElevenLabs — Agent AVA"
          description="Agent vocal IA · Voix française québécoise"
          emoji="🎙️"
          status={deriveStatus(rows.elevenlabs)}
          enabled={rows.elevenlabs?.is_enabled ?? false}
          lastTestedAt={rows.elevenlabs?.last_tested_at}
          lastTestResult={rows.elevenlabs?.last_test_result}
          lastTestSuccess={rows.elevenlabs?.last_test_success}
          onToggleEnabled={(v) => toggleEnabled("elevenlabs", v)}
          onSave={() => save("elevenlabs", ["api_key"])}
          onTest={() => test("elevenlabs")}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="ElevenLabs API Key" required hint="elevenlabs.io → Profile → API Keys">
              <SecretInput value={draft.elevenlabs?.api_key ?? ""}
                onChange={(v) => setField("elevenlabs", "api_key", v)}
                hasSavedValue={!!rows.elevenlabs?.config_data?.api_key}
                placeholder="sk_•••••••••••••••••••••••••••••" />
            </Field>
            <Field label="Agent ID par défaut" hint="ID de l'agent à utiliser pour les nouveaux courtiers">
              <TextInput value={getField("elevenlabs", "default_agent_id")}
                onChange={(e) => setField("elevenlabs", "default_agent_id", e.target.value)}
                placeholder="agent_xxxxxxxxxxxxx" />
            </Field>
            <Field label="Nom de l'agent">
              <TextInput value={getField("elevenlabs", "agent_name", "AVA - Planiprêt")}
                onChange={(e) => setField("elevenlabs", "agent_name", e.target.value)} />
            </Field>
            <Field label="Voice ID (Charlotte FR-CA)" hint="Par défaut: XB0fDUnXU5powFXDhCwa">
              <TextInput value={getField("elevenlabs", "voice_id", "XB0fDUnXU5powFXDhCwa")}
                onChange={(e) => setField("elevenlabs", "voice_id", e.target.value)} />
            </Field>
          </div>
          <InfoBanner tone="warn">
            L'agent vocal sera activable <strong>par courtier</strong> depuis Gestion Utilisateurs (+25 $/mois par activation).
          </InfoBanner>
        </IntegrationCard>

        {/* ───────── CARD 3 — MAESTRO CRM ───────── */}
        <IntegrationCard
          integrationKey="maestro" name="Maestro CRM (Kanguru)"
          description="Clients · Tâches · RDV · Pipeline · SMS"
          emoji="🏢"
          status={deriveStatus(rows.maestro)}
          enabled={rows.maestro?.is_enabled ?? false}
          lastTestedAt={rows.maestro?.last_tested_at}
          lastTestResult={rows.maestro?.last_test_result}
          lastTestSuccess={rows.maestro?.last_test_success}
          onToggleEnabled={(v) => toggleEnabled("maestro", v)}
          onSave={() => save("maestro", ["api_url", "api_key"])}
          onTest={() => test("maestro")}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="API URL Maestro" required>
              <TextInput value={getField("maestro", "api_url")}
                onChange={(e) => setField("maestro", "api_url", e.target.value)}
                placeholder="https://api.maestro-crm.ca/v1" />
            </Field>
            <Field label="API Key" required>
              <SecretInput value={draft.maestro?.api_key ?? ""}
                onChange={(v) => setField("maestro", "api_key", v)}
                hasSavedValue={!!rows.maestro?.config_data?.api_key} />
            </Field>
            <Field label="Webhook secret" hint="Pour vérifier les webhooks entrants Maestro">
              <SecretInput value={draft.maestro?.webhook_secret ?? ""}
                onChange={(v) => setField("maestro", "webhook_secret", v)}
                hasSavedValue={!!rows.maestro?.config_data?.webhook_secret} />
            </Field>
            <Field label="Pipeline par défaut (ID)">
              <TextInput value={getField("maestro", "default_pipeline_id")}
                onChange={(e) => setField("maestro", "default_pipeline_id", e.target.value)}
                placeholder="pipeline_prêt_hypothécaire" />
            </Field>
          </div>
        </IntegrationCard>

        {/* Batch 3 placeholders */}
        <ComingSoon emoji="🔗" name="Webhooks & Automatisation" description="Pipeline post-appel" />
        <ComingSoon emoji="📱" name="Application Mobile" description="iOS · Android · Push" fullWidth />
        <ComingSoon emoji="🔏" name="Conformité PIPEDA / Loi 25" description="Rétention, consentements" />

      </div>
    </div>
  );
}

function HealthPill({ color, bg, border, label }: { color: string; bg: string; border: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: bg, border: `1px solid ${border}`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}

function ComingSoon({ emoji, name, description, fullWidth }: { emoji: string; name: string; description: string; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}
      style={{ background: "#0A1628", border: "1px dashed #0E2A45", borderRadius: 16, padding: 16, opacity: 0.75 }}>
      <div className="flex items-center gap-3">
        <div className="text-2xl w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: "#0D1F35", border: "1px solid #0E2A45" }}>{emoji}</div>
        <div className="flex-1">
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 15, color: "#E8EDF5" }}>{name}</div>
          <div style={{ fontSize: 12, color: "#4A7FA5", marginTop: 2 }}>{description}</div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ background: "#0D1F35", border: "1px solid #0E2A45", color: "#4A7FA5" }}>Bientôt</span>
      </div>
    </div>
  );
}
