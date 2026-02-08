import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  MessageSquare,
  BarChart3,
  Phone,
  BookOpen,
  Users,
  Settings,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const modules = [
  { key: "agents", icon: Bot },
  { key: "conversations", icon: MessageSquare },
  { key: "analytics", icon: BarChart3 },
  { key: "telephony", icon: Phone },
  { key: "knowledge", icon: BookOpen },
  { key: "clients", icon: Users },
  { key: "settings", icon: Settings },
] as const;

type ModuleKey = (typeof modules)[number]["key"];

/* ── Mini previews per module ────────────────────────────── */

const AgentsPreview = ({ t }: { t: (key: string) => string }) => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20" />
        <div className="flex-1">
          <div className="h-2.5 rounded-full bg-muted/70 w-2/3 mb-2" />
          <div className="h-2 rounded-full bg-muted/50 w-1/2" />
        </div>
        <Badge variant="secondary" className="text-xs">ElevenLabs</Badge>
      </div>
    ))}
    <div className="flex items-end gap-0.5 h-6 mt-2">
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.div
          key={i}
          className="flex-1 bg-primary/40 rounded-t-sm"
          animate={{ height: [4, 10 + Math.sin(i) * 8, 4] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.06 }}
        />
      ))}
    </div>
  </div>
);

const ConversationsPreview = ({ t }: { t: (key: string) => string }) => {
  const sentiments = ["positive", "neutral", "negative", "positive"] as const;
  return (
    <div className="space-y-2">
      {sentiments.map((s, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
          <div className="w-8 h-8 rounded-full bg-muted/50" />
          <div className="flex-1">
            <div className="h-2.5 rounded-full bg-muted/70 w-3/4 mb-1.5" />
            <div className="h-2 rounded-full bg-muted/40 w-1/2" />
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              s === "positive" ? "border-success/50 text-success" : s === "negative" ? "border-destructive/50 text-destructive" : "border-muted-foreground/30"
            }`}
          >
            {t(`portalPreview.skeleton.${s}`)}
          </Badge>
        </div>
      ))}
    </div>
  );
};

const AnalyticsPreview = ({ t }: { t: (key: string) => string }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      {[
        { key: "satisfaction", value: "94%" },
        { key: "resolution", value: "87%" },
        { key: "volume", value: "1.2K" },
      ].map((m) => (
        <div key={m.key} className="rounded-xl bg-gradient-to-br from-primary/10 to-secondary/5 border border-border/40 p-3 text-center">
          <div className="text-lg font-bold">{m.value}</div>
          <div className="text-xs text-muted-foreground">{t(`portalPreview.skeleton.${m.key}`)}</div>
        </div>
      ))}
    </div>
    <div className="rounded-xl bg-muted/20 border border-border/40 h-24 p-3 flex items-end gap-1">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 bg-gradient-to-t from-secondary/50 to-secondary/10 rounded-t-sm"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  </div>
);

const TelephonyPreview = ({ t }: { t: (key: string) => string }) => (
  <div className="space-y-2">
    {["+1 (555) 234-5678", "+33 1 42 68 53 00", "+44 20 7946 0958"].map((n, i) => (
      <div key={i} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
        <Phone className="w-4 h-4 text-primary" />
        <span className="font-mono text-sm flex-1">{n}</span>
        <Badge variant={i === 0 ? "default" : "secondary"} className="text-xs">
          {i === 0 ? t('portalPreview.skeleton.active') : t('portalPreview.skeleton.ready')}
        </Badge>
      </div>
    ))}
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
      <span className="text-xs text-muted-foreground">{t('portalPreview.skeleton.liveMonitoring')}</span>
    </div>
  </div>
);

const KnowledgePreview = ({ t }: { t: (key: string) => string }) => (
  <div className="grid grid-cols-2 gap-2">
    {(["faq", "products", "policies", "scripts"] as const).map((catKey) => (
      <div key={catKey} className="rounded-xl border border-border/50 bg-background/40 p-3">
        <BookOpen className="w-4 h-4 text-muted-foreground mb-2" />
        <div className="text-sm font-medium mb-1">{t(`portalPreview.skeleton.${catKey}`)}</div>
        <div className="h-2 rounded-full bg-muted/50 w-3/4 mb-1" />
        <div className="h-2 rounded-full bg-muted/30 w-1/2" />
      </div>
    ))}
  </div>
);

const ClientsPreview = ({ t }: { t: (key: string) => string }) => (
  <div className="space-y-2">
    {["TechStart", "InnoGroup", "VoiceAgency"].map((name, i) => (
      <div key={name} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-primary-foreground"
          style={{
            background: `linear-gradient(135deg, hsl(${200 + i * 40}, 80%, 55%), hsl(${220 + i * 40}, 80%, 45%))`,
          }}
        >
          {name[0]}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{2 + i} {t('portalPreview.skeleton.agents')}</div>
        </div>
        <Badge variant="outline" className="text-xs">{t('portalPreview.skeleton.whiteLabel')}</Badge>
      </div>
    ))}
  </div>
);

const SettingsPreview = ({ t }: { t: (key: string) => string }) => (
  <div className="space-y-3">
    {(["organization", "branding", "apiKeys", "permissions"] as const).map((sKey) => (
      <div key={sKey} className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 p-3">
        <span className="text-sm">{t(`portalPreview.skeleton.${sKey}`)}</span>
        <div className="w-20 h-2.5 rounded-full bg-muted/60" />
      </div>
    ))}
  </div>
);

const previewComponents: Record<ModuleKey, (props: { t: (key: string) => string }) => JSX.Element> = {
  agents: AgentsPreview,
  conversations: ConversationsPreview,
  analytics: AnalyticsPreview,
  telephony: TelephonyPreview,
  knowledge: KnowledgePreview,
  clients: ClientsPreview,
  settings: SettingsPreview,
};

/* ── Main Section ────────────────────────────────────────── */

export const PortalPreviewSection = () => {
  const [active, setActive] = useState<ModuleKey>("agents");
  const navigate = useNavigate();
  const { t } = useTranslation();

  const Preview = previewComponents[active];

  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/8 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="secondary" className="gap-2 mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            {t("portalPreview.badge")}
          </Badge>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4">
            {t("portalPreview.title")}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("portalPreview.subtitle")}
          </p>
        </motion.div>

        {/* Interactive Portal */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative max-w-5xl mx-auto mb-12"
        >
          <div className="absolute -inset-3 bg-gradient-to-r from-primary/15 via-secondary/10 to-accent/15 rounded-3xl blur-2xl" />

          <div className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl overflow-hidden shadow-2xl">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50 bg-muted/30">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/50" />
                <div className="w-3 h-3 rounded-full bg-warning/50" />
                <div className="w-3 h-3 rounded-full bg-success/50" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-6 py-1 rounded-full bg-muted/50 text-xs text-muted-foreground font-mono">
                  admin.ava-platform.com
                </div>
              </div>
            </div>

            <div className="flex min-h-[380px]">
              {/* Sidebar */}
              <div className="w-48 md:w-56 border-r border-border/40 bg-muted/10 p-3 space-y-1">
                {modules.map((mod) => {
                  const isActive = active === mod.key;
                  return (
                    <button
                      key={mod.key}
                      onClick={() => setActive(mod.key)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-gradient-to-r from-primary/15 to-secondary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent"
                      }`}
                    >
                      <mod.icon className={`w-4 h-4 ${isActive ? "text-primary" : ""}`} />
                      {t(`portalPreview.modules.${mod.key}`)}
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              <div className="flex-1 p-5 md:p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Preview t={t} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom statement + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h3 className="text-2xl md:text-3xl font-bold mb-6">
            {t("portalPreview.statement")}
          </h3>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="lg"
              className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-xl shadow-primary/25"
              onClick={() => navigate("/demo-request")}
            >
              {t("portalPreview.cta")}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
