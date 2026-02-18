import { useState, useEffect, useCallback } from "react";
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
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Zap,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const SITE_URL = "attach-app-creator.lovable.app";

const modules = [
  { key: "agents",        icon: Bot,          color: "from-primary to-primary/70" },
  { key: "conversations", icon: MessageSquare, color: "from-violet-500 to-violet-400" },
  { key: "analytics",     icon: BarChart3,     color: "from-emerald-500 to-emerald-400" },
  { key: "telephony",     icon: Phone,         color: "from-amber-500 to-amber-400" },
  { key: "knowledge",     icon: BookOpen,      color: "from-sky-500 to-sky-400" },
  { key: "clients",       icon: Users,         color: "from-rose-500 to-rose-400" },
  { key: "settings",      icon: Settings,      color: "from-slate-500 to-slate-400" },
] as const;

type ModuleKey = (typeof modules)[number]["key"];

/* ─── Stat chip ─────────────────────────────────────── */
const Stat = ({ label, value, sub, gradient }: { label: string; value: string; sub?: string; gradient: string }) => (
  <div className={`rounded-2xl bg-gradient-to-br ${gradient} border border-border/30 p-3 md:p-4`}>
    <div className="text-xs text-muted-foreground mb-1">{label}</div>
    <div className="text-xl md:text-2xl font-extrabold tracking-tight">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);

/* ─── Bar chart ──────────────────────────────────────── */
const MiniBarChart = ({ color = "primary", bars = 16 }: { color?: string; bars?: number }) => {
  const heights = Array.from({ length: bars }, (_, i) =>
    Math.max(15, 25 + Math.sin(i * 0.9) * 20 + (i % 3) * 8)
  );
  return (
    <div className="flex items-end gap-1 h-20">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className={`flex-1 rounded-t-sm bg-gradient-to-t from-${color}/60 to-${color}/15`}
          style={{ background: `hsl(var(--${color}) / ${0.15 + (h / 80) * 0.55})` }}
          initial={{ height: 0 }}
          animate={{ height: `${h}%` }}
          transition={{ delay: i * 0.03, duration: 0.5, ease: "easeOut" }}
        />
      ))}
    </div>
  );
};

/* ─── Agents preview ─────────────────────────────────── */
const AgentsPreview = ({ t }: { t: (k: string) => string }) => (
  <div className="space-y-2.5">
    {[
      { name: "AVA Support", platform: "ElevenLabs", status: "live", calls: "1,247" },
      { name: "LeadQual Bot", platform: "Vapi",        status: "live", calls: "832" },
      { name: "Booking Agent", platform: "Retell AI",  status: "idle", calls: "418" },
    ].map((a, i) => (
      <motion.div
        key={a.name}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.08 }}
        className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 hover:border-primary/30 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{a.name}</div>
          <div className="text-xs text-muted-foreground">{a.platform}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-semibold text-foreground">{a.calls}</div>
          <div className={`text-[10px] font-medium ${a.status === "live" ? "text-emerald-500" : "text-amber-500"}`}>
            ● {a.status}
          </div>
        </div>
      </motion.div>
    ))}
    <div className="pt-1">
      <MiniBarChart color="primary" bars={14} />
    </div>
  </div>
);

/* ─── Conversations preview ──────────────────────────── */
const ConversationsPreview = ({ t }: { t: (k: string) => string }) => {
  const convs = [
    { name: "Marie D.",  time: "2m",  score: 98, tag: t("portalPreview.skeleton.positive") },
    { name: "Thomas K.", time: "8m",  score: 71, tag: t("portalPreview.skeleton.neutral") },
    { name: "Sofia R.",  time: "15m", score: 44, tag: t("portalPreview.skeleton.negative") },
    { name: "Léa M.",   time: "22m", score: 92, tag: t("portalPreview.skeleton.positive") },
  ];
  return (
    <div className="space-y-2">
      {convs.map((c, i) => (
        <motion.div
          key={c.name}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400/30 to-violet-600/20 flex items-center justify-center text-xs font-bold text-violet-600 flex-shrink-0">
            {c.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{c.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1.5 rounded-full bg-muted/60 w-24" />
              <div className="h-1.5 rounded-full bg-muted/40 w-12" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Badge
              variant="outline"
              className={`text-[10px] py-0 h-5 ${
                c.score >= 80 ? "border-emerald-500/40 text-emerald-500" :
                c.score >= 60 ? "border-amber-500/40 text-amber-500" :
                "border-rose-500/40 text-rose-500"
              }`}
            >
              {c.tag}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{c.time} {t("portalPreview.skeleton.ago")}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

/* ─── Analytics preview ──────────────────────────────── */
const AnalyticsPreview = ({ t }: { t: (k: string) => string }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      <Stat label={t("portalPreview.skeleton.satisfaction")} value="94.2%" gradient="from-emerald-500/10 to-emerald-400/5" />
      <Stat label={t("portalPreview.skeleton.resolution")}   value="87%"   gradient="from-sky-500/10 to-sky-400/5" />
      <Stat label={t("portalPreview.skeleton.volume")}       value="2.8K"  gradient="from-violet-500/10 to-violet-400/5" />
    </div>
    <div className="rounded-xl bg-muted/10 border border-border/40 p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-muted-foreground">Conversations / jour</span>
        <div className="flex items-center gap-1 text-emerald-500 text-xs font-medium">
          <TrendingUp className="w-3 h-3" /> +18%
        </div>
      </div>
      <MiniBarChart color="secondary" bars={18} />
    </div>
  </div>
);

/* ─── Telephony preview ───────────────────────────────── */
const TelephonyPreview = ({ t }: { t: (k: string) => string }) => (
  <div className="space-y-2">
    {[
      { num: "+1 (555) 234-5678", agent: "AVA Support",    status: t("portalPreview.skeleton.active"),  icon: CheckCircle, color: "text-emerald-500" },
      { num: "+33 1 42 68 53 00",  agent: "LeadQual Bot",  status: t("portalPreview.skeleton.ready"),   icon: Clock,       color: "text-amber-500" },
      { num: "+44 20 7946 0958",   agent: "Booking Agent", status: t("portalPreview.skeleton.ready"),   icon: Globe,       color: "text-sky-500" },
    ].map((line, i) => {
      const Icon = line.icon;
      return (
        <motion.div
          key={line.num}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.09 }}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5"
        >
          <Phone className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm">{line.num}</div>
            <div className="text-xs text-muted-foreground">{line.agent}</div>
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium ${line.color}`}>
            <Icon className="w-3.5 h-3.5" />
            {line.status}
          </div>
        </motion.div>
      );
    })}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.35 }}
      className="rounded-xl border border-primary/25 bg-primary/5 p-3 flex items-center gap-2"
    >
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-xs text-muted-foreground">{t("portalPreview.skeleton.liveMonitoring")}</span>
      <span className="ml-auto text-xs font-semibold text-primary">3 {t("portalPreview.skeleton.active")}</span>
    </motion.div>
  </div>
);

/* ─── Knowledge preview ───────────────────────────────── */
const KnowledgePreview = ({ t }: { t: (k: string) => string }) => (
  <div className="space-y-2">
    <div className="grid grid-cols-2 gap-2 mb-2">
      {(["faq", "products", "policies", "scripts"] as const).map((catKey, i) => (
        <motion.div
          key={catKey}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08 }}
          className="rounded-xl border border-border/50 bg-background/40 p-3"
        >
          <BookOpen className="w-4 h-4 text-sky-400 mb-1.5" />
          <div className="text-sm font-medium mb-1">{t(`portalPreview.skeleton.${catKey}`)}</div>
          <div className="h-1.5 rounded-full bg-muted/50 w-3/4 mb-1" />
          <div className="h-1.5 rounded-full bg-muted/30 w-1/2" />
          <div className="mt-2 text-[10px] text-muted-foreground">{4 + i * 3} articles</div>
        </motion.div>
      ))}
    </div>
    <div className="flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/5 p-2.5">
      <Zap className="w-3.5 h-3.5 text-sky-400" />
      <span className="text-xs text-muted-foreground">24 articles synced to ElevenLabs</span>
      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
    </div>
  </div>
);

/* ─── Clients preview ────────────────────────────────── */
const ClientsPreview = ({ t }: { t: (k: string) => string }) => (
  <div className="space-y-2">
    {[
      { name: "TechStart SAS",   agents: 4, revenue: "€2.4K",  bg: "bg-primary"   },
      { name: "InnoGroup",        agents: 2, revenue: "€1.1K",  bg: "bg-secondary" },
      { name: "VoiceAgency Pro",  agents: 6, revenue: "€5.8K",  bg: "bg-accent"    },
    ].map((c, i) => (
      <motion.div
        key={c.name}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.09 }}
        className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5"
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0 shadow-md ${c.bg}`}
        >
          {c.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{c.name}</div>
          <div className="text-xs text-muted-foreground">{c.agents} {t("portalPreview.skeleton.agents")}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-primary">{c.revenue}</div>
          <Badge variant="outline" className="text-[10px] py-0 h-4">{t("portalPreview.skeleton.whiteLabel")}</Badge>
        </div>
      </motion.div>
    ))}
    <div className="grid grid-cols-2 gap-2 pt-1">
      <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-border/30 p-2.5 text-center">
        <div className="text-lg font-bold">€9.3K</div>
        <div className="text-xs text-muted-foreground">MRR</div>
      </div>
      <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-400/5 border border-border/30 p-2.5 text-center">
        <div className="text-lg font-bold text-emerald-500">+22%</div>
        <div className="text-xs text-muted-foreground">vs last month</div>
      </div>
    </div>
  </div>
);

/* ─── Settings preview ───────────────────────────────── */
const SettingsPreview = ({ t }: { t: (k: string) => string }) => (
  <div className="space-y-2">
    {(["organization", "branding", "apiKeys", "permissions"] as const).map((sKey, i) => (
      <motion.div
        key={sKey}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.07 }}
        className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 px-3 py-2.5"
      >
        <span className="text-sm font-medium">{t(`portalPreview.skeleton.${sKey}`)}</span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 rounded-full bg-muted/50" />
          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        </div>
      </motion.div>
    ))}
    <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-2.5 mt-2">
      <Star className="w-3.5 h-3.5 text-amber-400" />
      <span className="text-xs text-muted-foreground">Plan: <span className="font-semibold text-foreground">Business</span></span>
      <Badge className="ml-auto text-[10px] py-0 h-4 bg-amber-500/20 text-amber-500 border-amber-500/30">Pro</Badge>
    </div>
  </div>
);

const previewMap: Record<ModuleKey, (props: { t: (k: string) => string }) => JSX.Element> = {
  agents:        AgentsPreview,
  conversations: ConversationsPreview,
  analytics:     AnalyticsPreview,
  telephony:     TelephonyPreview,
  knowledge:     KnowledgePreview,
  clients:       ClientsPreview,
  settings:      SettingsPreview,
};

/* ─── Main Section ───────────────────────────────────── */

export const PortalPreviewSection = () => {
  const [active, setActive] = useState<ModuleKey>("agents");
  const [paused, setPaused]   = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const moduleKeys = modules.map((m) => m.key);

  const advance = useCallback(() => {
    setActive((cur) => {
      const idx = moduleKeys.indexOf(cur);
      return moduleKeys[(idx + 1) % moduleKeys.length] as ModuleKey;
    });
  }, []);

  // Auto-transition every 3.5s unless user is hovering
  useEffect(() => {
    if (paused) return;
    const id = setInterval(advance, 3500);
    return () => clearInterval(id);
  }, [paused, advance]);

  const Preview = previewMap[active];
  const activeMod = modules.find((m) => m.key === active)!;
  const activeIdx = moduleKeys.indexOf(active);

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
          className="text-center mb-14"
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

        {/* Browser mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="relative max-w-5xl mx-auto mb-12"
        >
          {/* Glow */}
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/15 via-secondary/10 to-accent/15 rounded-3xl blur-2xl" />

          <div className="relative rounded-2xl border border-border/60 bg-card/70 backdrop-blur-xl overflow-hidden shadow-2xl">

            {/* ── Browser chrome ── */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-muted/30">
              {/* Traffic lights */}
              <div className="flex gap-1.5 flex-shrink-0">
                <div className="w-3 h-3 rounded-full bg-rose-500/70" />
                <div className="w-3 h-3 rounded-full bg-amber-400/70" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
              </div>

              {/* Tab strip */}
              <div className="flex gap-1 overflow-x-auto flex-1 px-1 scrollbar-hide">
                {modules.map((mod) => {
                  const isA = active === mod.key;
                  return (
                    <button
                      key={mod.key}
                      onClick={() => { setActive(mod.key); setPaused(true); }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-t-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                        isA
                          ? "bg-background text-foreground border-x border-t border-border/60 -mb-px pb-[5px]"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      }`}
                    >
                      <mod.icon className={`w-3 h-3 ${isA ? "text-primary" : ""}`} />
                      {t(`portalPreview.modules.${mod.key}`)}
                    </button>
                  );
                })}
              </div>

              {/* URL bar */}
              <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 border border-border/40">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground font-mono hidden sm:block">{SITE_URL}</span>
              </div>
            </div>

            {/* ── App shell ── */}
            <div className="flex min-h-[380px]">
              {/* Sidebar */}
              <div className="w-14 border-r border-border/40 bg-muted/10 py-4 flex flex-col items-center gap-2 flex-shrink-0">
                {modules.map((mod) => {
                  const isA = active === mod.key;
                  return (
                    <button
                      key={mod.key}
                      onClick={() => { setActive(mod.key); setPaused(true); }}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 ${
                        isA
                          ? `bg-gradient-to-br ${mod.color} shadow-md`
                          : "hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <mod.icon className={`w-4 h-4 ${isA ? "text-white" : ""}`} />
                    </button>
                  );
                })}
              </div>

              {/* Page title + content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Page header strip */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`header-${active}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-center gap-3 px-5 py-3 border-b border-border/30 bg-gradient-to-r ${activeMod.color} bg-opacity-5`}
                    style={{ backgroundImage: `linear-gradient(to right, hsl(var(--primary) / 0.04), transparent)` }}
                  >
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${activeMod.color} flex items-center justify-center flex-shrink-0`}>
                      <activeMod.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-semibold">{t(`portalPreview.modules.${active}`)}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs text-muted-foreground">Live</span>
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Module content */}
                <div className="flex-1 p-4 md:p-5 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={active}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.22 }}
                    >
                      <Preview t={t} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* ── Progress bar ── */}
            <div className="h-0.5 bg-muted/30 relative overflow-hidden">
              <motion.div
                key={active}
                className={`absolute inset-y-0 left-0 bg-gradient-to-r ${activeMod.color}`}
                initial={{ width: "0%" }}
                animate={{ width: paused ? `${((activeIdx + 1) / moduleKeys.length) * 100}%` : "100%" }}
                transition={{ duration: paused ? 0.2 : 3.5, ease: "linear" }}
              />
            </div>
          </div>

          {/* Floating module pill indicators */}
          <div className="flex justify-center gap-1.5 mt-4">
            {modules.map((mod, i) => (
              <button
                key={mod.key}
                onClick={() => { setActive(mod.key); setPaused(true); }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  active === mod.key ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-muted-foreground text-sm mb-4">
            {paused ? `📌 ${t("portalPreview.modules." + active)}` : "↑ " + t("portalPreview.badge")}
          </p>
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
