import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Bot,
  Wand2,
  Mic,
  Sliders,
  Rocket,
  ArrowRight,
  Check,
  ChevronRight,
  Zap,
  Globe,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const steps = [
  {
    icon: Bot,
    key: "s1",
    color: "from-blue-500 to-blue-600",
    nodeColor: "#3B82F6",
    detail: "ElevenLabs · Vapi · Retell",
  },
  {
    icon: Wand2,
    key: "s2",
    color: "from-violet-500 to-violet-600",
    nodeColor: "#8B5CF6",
    detail: "GPT-4 · Templates",
  },
  {
    icon: Mic,
    key: "s3",
    color: "from-pink-500 to-pink-600",
    nodeColor: "#EC4899",
    detail: "120+ voices · Preview",
  },
  {
    icon: Sliders,
    key: "s4",
    color: "from-amber-500 to-amber-600",
    nodeColor: "#F59E0B",
    detail: "Safety · Language · Style",
  },
  {
    icon: Rocket,
    key: "s5",
    color: "from-emerald-500 to-emerald-600",
    nodeColor: "#10B981",
    detail: "Push → Live in seconds",
  },
] as const;

// Animated flow diagram node
const FlowNode = ({
  step,
  index,
  activeStep,
  totalSteps,
  onClick,
}: {
  step: (typeof steps)[number];
  index: number;
  activeStep: number;
  totalSteps: number;
  onClick: () => void;
}) => {
  const Icon = step.icon;
  const isActive = activeStep === index;
  const isDone = index < activeStep;
  const angle = (index / (totalSteps - 1)) * Math.PI; // arc top to bottom

  // Layout: nodes arranged in an oval/arc shape
  const cx = 220; // center x
  const cy = 160; // center y
  const rx = 155; // horizontal radius
  const ry = 110; // vertical radius
  const t = (index / (totalSteps - 1)) * Math.PI;
  const x = cx - rx * Math.cos(t);
  const y = cy - ry * Math.sin(t) + ry * 0.2;

  return (
    <motion.g
      onClick={onClick}
      style={{ cursor: "pointer" }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.12, duration: 0.4, type: "spring" }}
    >
      {/* Glow ring for active */}
      {isActive && (
        <motion.circle
          cx={x}
          cy={y}
          r={26}
          fill="none"
          stroke={step.nodeColor}
          strokeWidth="1.5"
          opacity={0.5}
          animate={{ r: [26, 34, 26], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      {/* Done ring */}
      {isDone && (
        <circle cx={x} cy={y} r={22} fill={step.nodeColor} opacity={0.15} />
      )}

      {/* Main circle */}
      <motion.circle
        cx={x}
        cy={y}
        r={20}
        fill={isActive ? step.nodeColor : isDone ? step.nodeColor : "hsl(var(--muted))"}
        animate={{
          r: isActive ? 22 : 20,
          opacity: isDone || isActive ? 1 : 0.5,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Step number / check */}
      {isDone ? (
        <text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
          ✓
        </text>
      ) : (
        <text
          x={x}
          y={y + 5}
          textAnchor="middle"
          fill={isActive ? "white" : "hsl(var(--muted-foreground))"}
          fontSize="11"
          fontWeight="bold"
        >
          {index + 1}
        </text>
      )}

      {/* Label below node */}
      <text
        x={x}
        y={y + 36}
        textAnchor="middle"
        fill={isActive ? step.nodeColor : "hsl(var(--muted-foreground))"}
        fontSize="9"
        fontWeight={isActive ? "700" : "400"}
      >
        {step.detail}
      </text>
    </motion.g>
  );
};

// Connection arc between nodes
const FlowArc = ({
  from,
  to,
  totalSteps,
  activeStep,
  index,
}: {
  from: number;
  to: number;
  totalSteps: number;
  activeStep: number;
  index: number;
}) => {
  const cx = 220;
  const cy = 160;
  const rx = 155;
  const ry = 110;

  const getPos = (i: number) => {
    const t = (i / (totalSteps - 1)) * Math.PI;
    return { x: cx - rx * Math.cos(t), y: cy - ry * Math.sin(t) + ry * 0.2 };
  };

  const p1 = getPos(from);
  const p2 = getPos(to);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2 - 15;

  const d = `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
  const isActive = from < activeStep;

  return (
    <motion.path
      d={d}
      fill="none"
      stroke={isActive ? steps[from].nodeColor : "hsl(var(--border))"}
      strokeWidth={isActive ? "2" : "1"}
      strokeDasharray={isActive ? "none" : "4 4"}
      opacity={isActive ? 0.7 : 0.35}
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ delay: index * 0.12 + 0.2, duration: 0.5 }}
    />
  );
};

export const AgentCreationSection = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);

  const activeStepData = steps[activeStep];
  const ActiveIcon = activeStepData.icon;

  const benefits = [
    { icon: Zap, textKey: "landing.agentCreation.benefit1" },
    { icon: Globe, textKey: "landing.agentCreation.benefit2" },
    { icon: RefreshCw, textKey: "landing.agentCreation.benefit3" },
  ];

  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/5 to-background" />
      <div className="absolute top-10 right-[-120px] w-[420px] h-[420px] bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 left-[-160px] w-[520px] h-[520px] bg-secondary/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* ── LEFT: text + interactive steps ── */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="secondary" className="gap-2 mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              {t("landing.agentCreation.badge")}
            </Badge>

            <h2 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">
              {t("landing.agentCreation.title")}
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              {t("landing.agentCreation.subtitle")}
            </p>

            {/* Clickable steps list */}
            <div className="space-y-2 mb-8">
              {steps.map((s, idx) => {
                const Icon = s.icon;
                const isActive = activeStep === idx;
                const isDone = idx < activeStep;
                return (
                  <motion.button
                    key={s.key}
                    onClick={() => setActiveStep(idx)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${
                      isActive
                        ? "border-primary/40 bg-primary/5 shadow-sm"
                        : isDone
                        ? "border-border bg-muted/20"
                        : "border-transparent hover:bg-muted/30"
                    }`}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center flex-shrink-0 shadow-sm`}
                    >
                      {isDone ? (
                        <Check className="w-4 h-4 text-white" />
                      ) : (
                        <Icon className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            isActive ? "text-primary" : "text-foreground"
                          }`}
                        >
                          {t(`landing.agentCreation.${s.key}.title`)}
                        </span>
                        <span className="text-xs text-muted-foreground opacity-60">
                          {t("landing.agentCreation.step").replace("{{n}}", String(idx + 1))}
                        </span>
                      </div>
                      <AnimatePresence>
                        {isActive && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-xs text-muted-foreground mt-0.5 overflow-hidden"
                          >
                            {t(`landing.agentCreation.${s.key}.description`)}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 flex-shrink-0 transition-colors ${
                        isActive ? "text-primary" : "text-muted-foreground/30"
                      }`}
                    />
                  </motion.button>
                );
              })}
            </div>

            {/* Benefit pills */}
            <div className="flex flex-wrap gap-2 mb-8">
              {benefits.map((b, i) => {
                const BIcon = b.icon;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 border border-border rounded-full px-3 py-1.5"
                  >
                    <BIcon className="w-3 h-3 text-primary" />
                    {t(b.textKey)}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                onClick={() => navigate("/demo-request")}
                className="h-12 gap-2"
              >
                {t("landing.agentCreation.ctaDemo")}
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/login")}
                className="h-12"
              >
                {t("landing.agentCreation.ctaStart")}
              </Button>
            </div>
          </motion.div>

          {/* ── RIGHT: animated flow diagram ── */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            {/* Glow behind card */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 rounded-3xl blur-2xl" />

            <div className="relative rounded-3xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 shadow-2xl">

              {/* Active step detail pill */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.25 }}
                  className={`flex items-center gap-3 mb-5 p-3 rounded-xl bg-gradient-to-r ${activeStepData.color} bg-opacity-10 border border-white/10`}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <ActiveIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-semibold">
                      {t("landing.agentCreation.step").replace("{{n}}", String(activeStep + 1))} — {t(`landing.agentCreation.${activeStepData.key}.title`)}
                    </p>
                    <p className="text-white/70 text-xs">{activeStepData.detail}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
                    <span className="text-white/60 text-xs">Live</span>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* SVG flow diagram */}
              <div className="w-full" style={{ aspectRatio: "440/280" }}>
                <svg viewBox="0 0 440 280" className="w-full h-full overflow-visible">
                  <defs>
                    <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <rect width="440" height="280" fill="url(#bgGrad)" rx="12" />

                  {/* Center hub */}
                  <motion.circle
                    cx="220"
                    cy="140"
                    r="36"
                    fill="hsl(var(--primary))"
                    fillOpacity="0.08"
                    stroke="hsl(var(--primary))"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                    animate={{ r: [36, 40, 36] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.circle
                    cx="220"
                    cy="140"
                    r="26"
                    fill="hsl(var(--primary))"
                    fillOpacity="0.12"
                    animate={{ opacity: [0.12, 0.2, 0.12] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  />
                  <text x="220" y="136" textAnchor="middle" fill="hsl(var(--primary))" fontSize="9" fontWeight="700">AVA</text>
                  <text x="220" y="149" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="7">Platform</text>

                  {/* Arcs between nodes */}
                  {steps.slice(0, -1).map((_, i) => (
                    <FlowArc
                      key={i}
                      from={i}
                      to={i + 1}
                      totalSteps={steps.length}
                      activeStep={activeStep}
                      index={i}
                    />
                  ))}

                  {/* Lines from each node to center hub */}
                  {steps.map((s, i) => {
                    const cx2 = 220;
                    const cy2 = 160;
                    const rx2 = 155;
                    const ry2 = 110;
                    const t2 = (i / (steps.length - 1)) * Math.PI;
                    const nx = cx2 - rx2 * Math.cos(t2);
                    const ny = cy2 - ry2 * Math.sin(t2) + ry2 * 0.2;
                    const isConnected = i <= activeStep;
                    return (
                      <motion.line
                        key={`hub-${i}`}
                        x1={nx}
                        y1={ny}
                        x2={220}
                        y2={140}
                        stroke={isConnected ? s.nodeColor : "hsl(var(--border))"}
                        strokeWidth={isConnected ? "1.5" : "0.8"}
                        strokeDasharray="3 5"
                        opacity={isConnected ? 0.5 : 0.2}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ delay: i * 0.12, duration: 0.6 }}
                      />
                    );
                  })}

                  {/* Step nodes */}
                  {steps.map((s, i) => (
                    <FlowNode
                      key={s.key}
                      step={s}
                      index={i}
                      activeStep={activeStep}
                      totalSteps={steps.length}
                      onClick={() => setActiveStep(i)}
                    />
                  ))}
                </svg>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">{t("landing.agentCreation.progress")}</span>
                  <span className="text-xs font-semibold text-primary">
                    {Math.round(((activeStep + 1) / steps.length) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                    animate={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>

              {/* Step nav buttons */}
              <div className="flex justify-between mt-4">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep((s) => s - 1)}
                  className="text-xs h-8"
                >
                  ← {t("landing.agentCreation.prev")}
                </Button>
                <div className="flex gap-1.5 items-center">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveStep(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === activeStep ? "w-5 bg-primary" : i < activeStep ? "w-2 bg-primary/50" : "w-2 bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={activeStep === steps.length - 1}
                  onClick={() => setActiveStep((s) => s + 1)}
                  className="text-xs h-8"
                >
                  {t("landing.agentCreation.next")} →
                </Button>
              </div>

              {/* Platform badges */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                className="flex gap-2 mt-5 justify-center"
              >
                {["ElevenLabs", "Vapi", "Retell"].map((p, i) => (
                  <motion.div
                    key={p}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                  >
                    <Badge variant="outline" className="bg-background/60 backdrop-blur-sm text-xs">
                      {p}
                    </Badge>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
