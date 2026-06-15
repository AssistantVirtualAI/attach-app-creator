import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import {
  Sparkles, ArrowRight, Play, Plug, Bot, Users, BarChart3, Mic, RefreshCw,
  LayoutTemplate, BookOpen, Phone, Shield, User, Home, ShoppingCart, Scale,
  Check, X, Star, Menu, ChevronDown, ChevronUp, ArrowUp, Twitter, Linkedin,
  Github, Plus, Waves,
} from "lucide-react";

/* ---------------------- shared bits ---------------------- */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.21, 0.47, 0.32, 0.98] },
  }),
};

const Section = ({ id, className = "", children }: any) => (
  <section id={id} className={`relative py-24 px-6 ${className}`}>
    <div className="max-w-7xl mx-auto relative">{children}</div>
  </section>
);

const Eyebrow = ({ children }: any) => (
  <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-cyan-400 mb-4">
    {children}
  </span>
);

const SectionHeader = ({ eyebrow, title, subtitle, center = true }: any) => (
  <div className={`${center ? "text-center mx-auto" : ""} max-w-3xl mb-16`}>
    {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
    <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-5 font-display">
      {title}
    </h2>
    {subtitle && <p className="text-lg text-slate-400 leading-relaxed">{subtitle}</p>}
  </div>
);

const GradientOrbs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-cyan-500/20 blur-[120px]"
    />
    <motion.div
      animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-1/3 -right-32 w-[600px] h-[600px] rounded-full bg-blue-500/20 blur-[140px]"
    />
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b22_1px,transparent_1px),linear-gradient(to_bottom,#1e293b22_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
  </div>
);

/* ---------------------- Navbar ---------------------- */

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on(); window.addEventListener("scroll", on);
    return () => window.removeEventListener("scroll", on);
  }, []);
  const links = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "Integrations", href: "#integrations" },
    { label: "API Docs", href: "#faq" },
  ];
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all ${
      scrolled ? "bg-slate-950/70 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
    }`}>
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2 text-white font-semibold">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Waves className="w-4 h-4 text-white" />
          </span>
          <span className="font-display tracking-tight">AVA Statistics</span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-slate-300 hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-sm text-slate-300 hover:text-white transition-colors">Log In</Link>
          <Link to="/login"
            className="text-sm font-medium px-4 py-2 rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]">
            Start Free Trial
          </Link>
        </div>
        <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-white" aria-label="Toggle menu">
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-slate-950/95 backdrop-blur-xl border-b border-white/5 overflow-hidden">
            <div className="px-6 py-4 space-y-2">
              {links.map(l => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)}
                  className="block py-2 text-slate-300 hover:text-white">{l.label}</a>
              ))}
              <Link to="/login" className="block py-2 text-slate-300">Log In</Link>
              <Link to="/login" className="block mt-2 py-2 text-center rounded-full bg-cyan-500 text-slate-950 font-medium">
                Start Free Trial
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

/* ---------------------- Hero ---------------------- */

const Hero = () => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 100]);
  const stats = [
    ["50K+", "Agents Deployed"], ["10M+", "Conversations"],
    ["99.9%", "Uptime"], ["4.9/5", "Average Rating"],
  ];
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-16 px-6 overflow-hidden">
      <GradientOrbs />
      <motion.div style={{ y }} className="max-w-7xl mx-auto relative w-full">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div variants={fadeUp} initial="hidden" animate="show"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm mb-8">
            <Sparkles className="w-4 h-4" />
            Now with Lemtel FashionPBX Integration
          </motion.div>
          <motion.h1 variants={fadeUp} initial="hidden" animate="show" custom={1}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-6 font-display leading-[1.05]">
            Deploy AI Voice Agents for Your Clients —{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              From One Portal
            </span>
          </motion.h1>
          <motion.p variants={fadeUp} initial="hidden" animate="show" custom={2}
            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Create, manage, and white-label voice AI agents across ElevenLabs, Vapi, and Retell.
            Built-in telephony, real-time analytics, and secure client portals — all in one clean dashboard.
          </motion.p>
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/login"
              className="group flex items-center gap-2 px-7 py-3.5 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-all shadow-[0_0_30px_rgba(6,182,212,0.5)] hover:shadow-[0_0_50px_rgba(6,182,212,0.7)] hover:scale-105">
              Start 14-Day Free Trial
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#live-demo"
              className="flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/15 text-white hover:bg-white/5 transition-all">
              <Play className="w-4 h-4" /> Watch Demo
            </a>
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0 max-w-3xl mx-auto">
            {stats.map(([v, l], i) => (
              <div key={l} className={`text-center ${i > 0 ? "md:border-l md:border-white/10" : ""}`}>
                <div className="text-2xl md:text-3xl font-bold text-white font-display">{v}</div>
                <div className="text-xs uppercase tracking-wider text-slate-500 mt-1">{l}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Dashboard mockup */}
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }} className="mt-20 relative">
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 blur-3xl rounded-3xl" />
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10 bg-slate-950/50">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-4 text-xs text-slate-500">avastatistic.ca / agency</span>
            </div>
            <div className="grid grid-cols-12 gap-4 p-6">
              <div className="col-span-3 space-y-2">
                {["Dashboard", "Agents", "Clients", "Analytics", "Telephony", "Webhooks"].map((n, i) => (
                  <div key={n} className={`px-3 py-2 rounded-lg text-sm ${i === 1 ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400"}`}>
                    {n}
                  </div>
                ))}
              </div>
              <div className="col-span-9 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[["Active Agents", "47"], ["Calls Today", "1,284"], ["Avg Latency", "0.8s"]].map(([l, v]) => (
                    <div key={l} className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
                      <div className="text-xs text-slate-500">{l}</div>
                      <div className="text-xl font-bold text-white mt-1">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 h-40 relative overflow-hidden">
                  <div className="text-xs text-slate-500 mb-2">Conversations · last 24h</div>
                  <svg viewBox="0 0 300 100" className="w-full h-24">
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,80 C40,60 60,40 90,45 C120,50 140,20 170,25 C200,30 220,55 250,40 C275,28 290,35 300,30 L300,100 L0,100 Z" fill="url(#g1)" />
                    <path d="M0,80 C40,60 60,40 90,45 C120,50 140,20 170,25 C200,30 220,55 250,40 C275,28 290,35 300,30"
                      fill="none" stroke="#06b6d4" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Social proof */}
        <div className="mt-20 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-6">Trusted by 500+ companies</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-50">
            {["TechStart", "InnoGroup", "VoiceAgency", "RealEstatePro", "LegalFlow", "ShopMax"].map(n => (
              <span key={n} className="text-slate-400 font-display font-semibold tracking-tight">{n}</span>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
};

/* ---------------------- Problem / Solution ---------------------- */

const ProblemSolution = () => {
  const pains = [
    "Context switching kills productivity",
    "No white-label options for clients",
    "Telephony setup takes weeks",
    "Analytics scattered across platforms",
  ];
  const solutions = [
    "Multi-client agency portal",
    "Native ElevenLabs, Vapi, Retell sync",
    "Built-in Twilio + Lemtel telephony",
    "Real-time unified analytics",
  ];
  return (
    <Section className="bg-[#111827]">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}>
          <Eyebrow>The Old Way</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-5 font-display">
            Juggling 4–5 tools just to manage voice AI?
          </h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            One dashboard for ElevenLabs. Another for Vapi. A separate telephony platform.
            A different analytics tool. And somehow you're still building client portals from scratch.
            It's expensive, fragmented, and impossible to scale.
          </p>
          <ul className="space-y-3">
            {pains.map(p => (
              <li key={p} className="flex items-center gap-3 text-slate-400">
                <span className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                  <X className="w-3.5 h-3.5 text-red-400" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </motion.div>
        <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={1}
          className="relative lg:pl-12 lg:border-l lg:border-white/10">
          <Eyebrow>The AVA Way</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-5 font-display">
            One platform. Every provider. Zero complexity.
          </h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            AVA replaces your entire voice AI stack. Connect your providers, build agents in minutes,
            give clients their own branded portal, and manage telephony end-to-end — all from one clean interface.
          </p>
          <ul className="space-y-3">
            {solutions.map(p => (
              <li key={p} className="flex items-center gap-3 text-slate-200">
                <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </Section>
  );
};

/* ---------------------- How It Works ---------------------- */

const HowItWorks = () => {
  const steps = [
    { n: "01", Icon: Plug, t: "Connect Provider", d: "Link your ElevenLabs, Vapi, or Retell account with one click." },
    { n: "02", Icon: Bot, t: "Build Agent", d: "Use templates to configure voice, prompt, and knowledge base." },
    { n: "03", Icon: Users, t: "Invite Client", d: "Generate a branded client portal with secure access controls." },
    { n: "04", Icon: BarChart3, t: "Analyze & Optimize", d: "Track calls, sentiment, and outcomes in real time." },
  ];
  return (
    <Section id="how-it-works">
      <SectionHeader title="From Idea to Live Agent in 4 Steps"
        subtitle="No code required. Average deploy time: under 5 minutes." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {steps.map(({ n, Icon, t, d }, i) => (
          <motion.div key={n} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={i}
            className="relative rounded-2xl border border-white/10 bg-slate-900/40 p-6 hover:border-cyan-500/30 hover:bg-slate-900/70 transition-all">
            <div className="text-5xl font-bold text-cyan-500/20 font-display mb-4">{n}</div>
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
              <Icon className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{t}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{d}</p>
          </motion.div>
        ))}
      </div>
      <div className="text-center mt-12">
        <a href="#features" className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/15 text-white hover:bg-white/5 transition">
          See Full Workflow <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </Section>
  );
};

/* ---------------------- Live Demo ---------------------- */

const useCount = (target: number, start: boolean, duration = 1500) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    const t0 = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target, duration]);
  return v;
};

const LiveDemo = () => {
  const [inView, setInView] = useState(false);
  const responseTime = useCount(0.8, inView);
  const convs = useCount(1247, inView);
  const sat = useCount(94.2, inView);

  const transcript = [
    { who: "Customer", text: "Hi, I'd like to book a viewing for the listing on Oak Street." },
    { who: "AVA Agent", text: "Of course. I have availability tomorrow at 2pm or Friday at 10am. Which works?" },
    { who: "Customer", text: "Tomorrow 2pm sounds great." },
    { who: "AVA Agent", text: "Booked. I'll text the confirmation to your number now." },
  ];

  return (
    <Section id="live-demo" className="bg-gradient-to-b from-slate-950 to-[#0b1424]">
      <motion.div onViewportEnter={() => setInView(true)} viewport={{ once: true }} />
      <SectionHeader title="Watch Your AI Agent Work in Real Time"
        subtitle="No sign-up needed. See how AVA handles a real customer conversation." />
      <div className="relative">
        <div className="absolute -inset-6 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-3xl rounded-3xl" />
        <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-slate-950/50">
            <div className="flex items-center gap-2 text-sm text-white">
              <span className="font-semibold">AVA Agent</span>
              <span className="text-slate-500">— Online · Responding Instantly</span>
            </div>
            <div className="flex items-center gap-2">
              <motion.span animate={{ scale: [1, 1.4, 1], opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">LIVE</span>
            </div>
          </div>
          <div className="grid lg:grid-cols-5 gap-0">
            <div className="lg:col-span-3 p-6 space-y-3 border-b lg:border-b-0 lg:border-r border-white/10">
              {transcript.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: m.who === "Customer" ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.4 }}
                  className={`flex ${m.who === "Customer" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.who === "Customer"
                      ? "bg-slate-800 text-slate-200"
                      : "bg-cyan-500/15 border border-cyan-500/30 text-cyan-100"
                  }`}>
                    <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{m.who}</div>
                    {m.text}
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="lg:col-span-2 p-6 space-y-3 bg-slate-950/30">
              {[
                ["Avg. Response Time", `${responseTime.toFixed(1)}s`],
                ["Conversations Today", Math.round(convs).toLocaleString()],
                ["Customer Satisfaction", `${sat.toFixed(1)}%`],
                ["Uptime", "99.9%"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                  <div className="text-xs text-slate-500">{l}</div>
                  <div className="text-2xl font-bold text-white font-display mt-1">{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-5 py-3 border-t border-white/10 bg-slate-950/50 text-xs text-slate-500 text-center">
            Processing 24/7 — Your AI agent never sleeps
          </div>
        </div>
      </div>
      <div className="text-center mt-10">
        <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition">
          Explore the Dashboard <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </Section>
  );
};

/* ---------------------- Features ---------------------- */

const Features = () => {
  const items = [
    { Icon: Mic, t: "Voice AI Agents", d: "Create conversational agents with natural voices and intelligent responses across multiple providers." },
    { Icon: RefreshCw, t: "Multi-Platform Sync", d: "Connect ElevenLabs, Vapi, and Retell. Sync agents in one click with no context switching." },
    { Icon: LayoutTemplate, t: "White-Label Client Portal", d: "Give clients secure, branded access to manage their agents and view analytics." },
    { Icon: BarChart3, t: "Advanced Analytics", d: "Real-time dashboards, sentiment analysis, topic insights, and automated reports." },
    { Icon: BookOpen, t: "Knowledge Base", d: "Enrich agents with documents, FAQs, and custom data for accurate, contextual responses." },
    { Icon: Phone, t: "Built-in Telephony", d: "End-to-end Twilio management plus Lemtel FashionPBX integration — numbers, routing, recordings, softphones." },
  ];
  return (
    <Section id="features">
      <SectionHeader title="Everything You Need to Scale Voice AI"
        subtitle="A complete suite of tools to create, manage, and optimize your voice AI agents." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map(({ Icon, t, d }, i) => (
          <motion.div key={t} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={i}
            className="group rounded-2xl border border-white/10 bg-slate-900/40 p-6 hover:border-cyan-500/40 hover:-translate-y-1 transition-all">
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 group-hover:bg-cyan-500/20 transition">
              <Icon className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{t}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{d}</p>
          </motion.div>
        ))}
      </div>
      <div className="text-center mt-10">
        <a href="#pricing" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1.5 text-sm font-medium">
          View All Features <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </Section>
  );
};

/* ---------------------- Two Portals ---------------------- */

const Portals = () => {
  const portals = [
    {
      Icon: Shield, t: "Agency Portal", tag: "Full Control", accent: "blue",
      items: ["Multi-client management", "Unlimited agent creation", "Global analytics",
        "Billing & subscriptions", "Complete white-label", "API & Webhooks"],
    },
    {
      Icon: User, t: "Client Portal", tag: "Personalized Access", accent: "cyan",
      items: ["Dedicated agent view", "Real-time conversations", "Personal analytics",
        "Prompt management", "Knowledge base", "Customizable interface"],
    },
  ];
  const rows = [
    ["Multi-client management", "✓", "—", "Single tenant per portal"],
    ["Agent configuration", "✓", "Limited", "Clients edit prompt & KB"],
    ["Global analytics", "✓", "—", "Across all clients"],
    ["Per-client analytics", "✓", "✓", "Scoped to their data"],
    ["Billing & subscriptions", "✓", "—", "Agency-side only"],
    ["White-label branding", "✓", "Inherited", "Per-client themes"],
    ["API & Webhooks", "✓", "Read-only", "Full vs scoped tokens"],
  ];
  return (
    <Section id="portals" className="bg-[#111827]">
      <SectionHeader title="Two Portals. One Platform. Zero Complexity." />
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {portals.map(({ Icon, t, tag, accent, items }) => (
          <motion.div key={t} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
            className={`rounded-2xl border p-7 bg-slate-900/40 ${
              accent === "cyan" ? "border-cyan-500/30" : "border-blue-500/30"
            }`}>
            <div className="flex items-center gap-4 mb-5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                accent === "cyan" ? "bg-cyan-500/15 text-cyan-400" : "bg-blue-500/15 text-blue-400"
              }`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">{t}</h3>
                <p className={`text-sm ${accent === "cyan" ? "text-cyan-400" : "text-blue-400"}`}>{tag}</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {items.map(it => (
                <li key={it} className="flex items-center gap-2.5 text-slate-300 text-sm">
                  <Check className={`w-4 h-4 ${accent === "cyan" ? "text-cyan-400" : "text-blue-400"}`} /> {it}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 overflow-hidden bg-slate-900/40">
        <table className="w-full text-sm">
          <thead className="bg-slate-950/40 text-slate-400">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Feature</th>
              <th className="px-5 py-3 font-medium text-blue-300">Agency Portal</th>
              <th className="px-5 py-3 font-medium text-cyan-300">Client Portal</th>
              <th className="text-left px-5 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-5 py-3 text-slate-200">{r[0]}</td>
                <td className="px-5 py-3 text-center text-emerald-400">{r[1]}</td>
                <td className="px-5 py-3 text-center text-emerald-400">{r[2]}</td>
                <td className="px-5 py-3 text-slate-500">{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap justify-center gap-3 mt-10">
        <Link to="/login" className="px-5 py-2.5 rounded-full border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 text-sm">
          Explore the Agency Portal
        </Link>
        <Link to="/login" className="px-5 py-2.5 rounded-full border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 text-sm">
          See the Client Portal
        </Link>
      </div>
    </Section>
  );
};

/* ---------------------- Integrations ---------------------- */

const Integrations = () => {
  const logos = ["ElevenLabs", "Vapi", "Retell AI", "OpenAI", "Twilio", "Google"];
  return (
    <Section id="integrations">
      <SectionHeader title="Connect Your Stack"
        subtitle="Native integrations with the leading voice AI and telephony providers." />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {logos.map(l => (
          <div key={l} className="h-20 rounded-xl border border-white/10 bg-slate-900/40 flex items-center justify-center text-slate-400 hover:text-white hover:border-cyan-500/40 transition font-display font-semibold">
            {l}
          </div>
        ))}
      </div>
      <p className="text-center text-slate-500 text-sm mb-10 flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> And more coming soon
      </p>
      {/* Lemtel compact */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-900/20 p-5 max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex-shrink-0">
          <Phone className="w-3.5 h-3.5" /> Powered by Lemtel FashionPBX
        </span>
        <p className="text-sm text-slate-400 flex-1">
          Cloud PBX, desktop softphone, mobile app, and click-to-dial — fully integrated with your AVA agents.
        </p>
        <a href="#faq" className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 flex-shrink-0">
          Learn More <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </Section>
  );
};

/* ---------------------- Comparison ---------------------- */

const Comparison = () => {
  const cols = ["Feature", "AVA Platform", "ChatDash", "Generic Tools", "Custom Build"];
  const rows: (string | boolean)[][] = [
    ["Multi-client portals", true, true, false, true],
    ["Voice AI providers (ElevenLabs/Vapi/Retell)", true, "Limited", false, true],
    ["White-label client portal", true, false, false, true],
    ["Built-in telephony (Twilio)", true, false, false, true],
    ["AI analytics & sentiment", true, "Partial", false, true],
    ["Full white-labeling", true, false, false, true],
    ["Agent knowledge base", true, false, false, true],
    ["Time to set up", "Minutes", "Hours", "Weeks", "3–6 months"],
    ["Pricing model", "Flat · scalable", "Per seat", "Per usage", "$$$ upfront"],
  ];
  const cell = (v: string | boolean, highlight = false) => {
    if (v === true) return <Check className={`w-5 h-5 mx-auto ${highlight ? "text-emerald-400" : "text-emerald-500/70"}`} />;
    if (v === false) return <X className="w-5 h-5 mx-auto text-slate-600" />;
    return <span className={highlight ? "text-cyan-300 font-medium" : "text-slate-400"}>{v}</span>;
  };
  return (
    <Section className="bg-[#111827]">
      <SectionHeader title="Why Teams Choose AVA Over the Alternatives"
        subtitle="A transparent look at what AVA offers versus generic tools and custom builds." />
      <div className="rounded-2xl border border-white/10 overflow-x-auto bg-slate-900/40">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-slate-950/40">
            <tr>
              {cols.map((c, i) => (
                <th key={c} className={`px-5 py-4 ${i === 0 ? "text-left" : "text-center"} ${
                  i === 1 ? "text-cyan-300 bg-cyan-500/5" : "text-slate-400"} font-semibold`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-5 py-3 text-slate-200">{r[0] as string}</td>
                <td className="px-5 py-3 text-center bg-cyan-500/5">{cell(r[1], true)}</td>
                <td className="px-5 py-3 text-center">{cell(r[2])}</td>
                <td className="px-5 py-3 text-center">{cell(r[3])}</td>
                <td className="px-5 py-3 text-center">{cell(r[4])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid md:grid-cols-3 gap-5 mt-12">
        {[
          ["All-in-one, not all-over-the-place", "Replace 4–5 separate tools with one portal."],
          ["Built for agencies & resellers", "Manage multiple clients, each with their own branded portal."],
          ["Production-ready from day one", "Your first agent live in minutes, not months."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
            <h4 className="text-white font-semibold mb-2">{t}</h4>
            <p className="text-sm text-slate-400">{d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
};

/* ---------------------- Industries ---------------------- */

const Industries = () => {
  const items = [
    { Icon: Home, t: "Real Estate", d: "Qualify leads 24/7, capture inquiries, book viewings.", s: "72%", l: "fewer missed opportunities" },
    { Icon: Shield, t: "Insurance", d: "Handle claims, collect info, route to agents instantly.", s: "3×", l: "faster claim intake" },
    { Icon: ShoppingCart, t: "E-commerce", d: "Answer product questions, track orders, resolve issues.", s: "89%", l: "resolved without human" },
    { Icon: Scale, t: "Legal & Pro Services", d: "Book consultations, answer FAQs, qualify prospects.", s: "40%", l: "more booked consultations" },
  ];
  return (
    <Section>
      <SectionHeader title="Built for Industries That Can't Afford to Miss a Call" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {items.map(({ Icon, t, d, s, l }, i) => (
          <motion.div key={t} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={i}
            className="rounded-2xl border border-white/10 bg-slate-900/40 p-6 hover:border-cyan-500/30 transition">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
              <Icon className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">{t}</h3>
            <p className="text-sm text-slate-400 mb-5 leading-relaxed">{d}</p>
            <div className="text-3xl font-bold text-cyan-400 font-display">{s}</div>
            <div className="text-xs text-slate-500 mt-1">{l}</div>
            <div className="text-[10px] text-slate-600 mt-3">Results based on average customer data.</div>
          </motion.div>
        ))}
      </div>
      <div className="text-center mt-10">
        <a href="#testimonials" className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/15 text-white hover:bg-white/5 transition">
          See All Use Cases <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </Section>
  );
};

/* ---------------------- Testimonials ---------------------- */

const Testimonials = () => {
  const items = [
    { q: "AVA has revolutionized our customer service. Our AI agents handle 80% of requests automatically.",
      n: "Marie Dupont", r: "CEO", c: "TechStart", i: "MD" },
    { q: "The voice quality and intelligence of responses are impressive. Our customers love it.",
      n: "Jean Martin", r: "Sales Director", c: "InnoGroup", i: "JM" },
    { q: "The client portal is a game-changer. My clients manage their agents independently.",
      n: "Sophie Bernard", r: "Founder", c: "VoiceAgency", i: "SB" },
  ];
  return (
    <Section id="testimonials" className="bg-gradient-to-b from-[#111827] to-slate-950">
      <SectionHeader title="Trusted by Agencies Worldwide" />
      <div className="grid md:grid-cols-3 gap-5">
        {items.map((t, i) => (
          <motion.div key={t.n} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={i}
            className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
            <div className="flex gap-1 mb-4">
              {Array.from({ length: 5 }).map((_, k) => (
                <Star key={k} className="w-4 h-4 fill-cyan-400 text-cyan-400" />
              ))}
            </div>
            <p className="text-slate-200 leading-relaxed mb-6">"{t.q}"</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-slate-950 font-semibold text-sm">
                {t.i}
              </div>
              <div>
                <div className="text-white text-sm font-medium">{t.n}</div>
                <div className="text-xs text-slate-500">{t.r} · {t.c}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="text-center text-sm text-slate-500 mt-10">
        4.9/5 Average Rating · 500+ Active Companies · 95% Satisfaction Rate
      </p>
    </Section>
  );
};

/* ---------------------- Pricing ---------------------- */

const Pricing = () => {
  const plans = [
    { n: "Starter", p: "$69", note: "5 clients included", extra: "+$10 per additional client",
      f: ["5,000 conversations/month", "Unlimited agents", "Advanced analytics", "Email support (48h response)", "3 integrations"],
      cta: "Start Free Trial" },
    { n: "Growth", p: "$199", note: "15 clients included", extra: "+$8 per additional client", popular: true,
      f: ["25,000 conversations/month", "Unlimited agents", "Enterprise analytics + AI insights", "Priority support (24h response)", "Unlimited integrations"],
      cta: "Start Free Trial" },
    { n: "Ultimate", p: "$399", note: "50 clients included", extra: "+$5 per additional client",
      f: ["Unlimited conversations", "Unlimited agents", "Custom analytics dashboard", "Dedicated support (4h response)", "Unlimited integrations"],
      cta: "Start Free Trial" },
    { n: "Enterprise", p: "Custom", note: "Unlimited everything", extra: "",
      f: ["Unlimited clients, agents, conversations", "Custom analytics + BI integration", "24/7 dedicated support", "On-premise deployment option"],
      cta: "Contact Sales" },
  ];
  return (
    <Section id="pricing">
      <SectionHeader title="Transparent Pricing for Every Stage"
        subtitle="14-day free trial on all plans. No credit card required. Cancel anytime." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((p, i) => (
          <motion.div key={p.n} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} custom={i}
            className={`relative rounded-2xl border p-6 flex flex-col ${
              p.popular
                ? "border-cyan-500/50 bg-gradient-to-b from-cyan-500/10 to-slate-900/40 shadow-[0_0_40px_rgba(6,182,212,0.25)]"
                : "border-white/10 bg-slate-900/40"
            }`}>
            {p.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-cyan-500 text-slate-950 text-xs font-semibold">
                Most Popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-white">{p.n}</h3>
            <div className="mt-4 mb-1">
              <span className="text-4xl font-bold text-white font-display">{p.p}</span>
              {p.p !== "Custom" && <span className="text-slate-500 text-sm"> CAD/mo</span>}
            </div>
            <p className="text-sm text-slate-400">{p.note}</p>
            {p.extra && <p className="text-xs text-slate-500 mt-1">{p.extra}</p>}
            <ul className="my-6 space-y-2.5 flex-1">
              {p.f.map(ft => (
                <li key={ft} className="flex items-start gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" /> {ft}
                </li>
              ))}
            </ul>
            <Link to="/login"
              className={`mt-auto block text-center px-4 py-2.5 rounded-full font-medium text-sm transition ${
                p.popular
                  ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                  : "border border-white/15 text-white hover:bg-white/5"
              }`}>
              {p.cta}
            </Link>
          </motion.div>
        ))}
      </div>
      <p className="text-center text-xs text-slate-500 mt-8">
        All plans include a 14-day free trial. Cancel anytime. Prices in CAD.
      </p>
    </Section>
  );
};

/* ---------------------- FAQ ---------------------- */

const FAQ = () => {
  const items = [
    ["How does pricing work?", "Monthly subscriptions with flexible tiers. Upgrade or downgrade anytime. 14-day free trial included on all plans."],
    ["Which voice platforms are supported?", "Native integrations with ElevenLabs, Vapi, Retell AI, and others. Connect your own API key or use our managed integrations."],
    ["Can my clients customize their agents?", "Yes. Through their white-labeled client portal, they can edit prompts, enrich the knowledge base, and customize agent behavior."],
    ["Is AVA secure and compliant?", "Absolutely. End-to-end encryption, GDPR compliant, and HIPAA options available for healthcare use cases."],
    ["Do you offer API access?", "Yes. Complete REST API and webhooks to integrate with your CRM, support tools, and existing phone systems."],
    ["What support do you offer?", "Email support for all plans, priority support for Growth, and dedicated 24/7 support for Enterprise with a dedicated account manager."],
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq" className="bg-[#111827]">
      <SectionHeader title="Everything You Need to Know" />
      <div className="max-w-3xl mx-auto space-y-3">
        {items.map(([q, a], i) => (
          <div key={q} className="rounded-xl border border-white/10 bg-slate-900/40 overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left text-white">
              <span className="font-medium">{q}</span>
              {open === i ? <ChevronUp className="w-4 h-4 text-cyan-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            <AnimatePresence>
              {open === i && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                  className="overflow-hidden">
                  <p className="px-5 pb-4 text-sm text-slate-400 leading-relaxed">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-slate-500 mt-8">
        Still have questions? Contact us at{" "}
        <a href="mailto:support@avastatistic.ca" className="text-cyan-400 hover:text-cyan-300">support@avastatistic.ca</a>
      </p>
    </Section>
  );
};

/* ---------------------- Final CTA ---------------------- */

const FinalCTA = () => (
  <section className="relative py-28 px-6 overflow-hidden bg-gradient-to-br from-slate-950 via-cyan-950/40 to-slate-950">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.25),transparent_60%)]" />
    <div className="relative max-w-3xl mx-auto text-center">
      <h2 className="text-3xl md:text-5xl font-bold text-white font-display tracking-tight mb-5">
        Ready to Scale Your Voice AI Agency?
      </h2>
      <p className="text-lg text-slate-300 mb-8">
        Join 50+ agencies already using AVA to automate their customer interactions.
      </p>
      <Link to="/login"
        className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-all shadow-[0_0_40px_rgba(6,182,212,0.6)] hover:shadow-[0_0_60px_rgba(6,182,212,0.8)] hover:scale-105">
        Start Your 14-Day Free Trial <ArrowRight className="w-4 h-4" />
      </Link>
      <p className="text-sm text-slate-400 mt-5">
        No credit card required · Setup in minutes · Cancel anytime
      </p>
      <p className="text-xs text-slate-500 mt-3">
        🎉 50K+ agents deployed · 10M+ conversations handled
      </p>
    </div>
  </section>
);

/* ---------------------- Footer ---------------------- */

const Footer = () => {
  const cols = [
    { t: "Product", l: ["Features", "Pricing", "Integrations", "API Docs", "Changelog"] },
    { t: "Company", l: ["About", "Blog", "Careers", "Contact", "Legal"] },
    { t: "Resources", l: ["Documentation", "Help Center", "Community", "Status Page"] },
  ];
  return (
    <footer className="bg-[#030712] border-t border-white/5 px-6 pt-16 pb-8">
      <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 text-white font-semibold mb-3">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <Waves className="w-4 h-4 text-white" />
            </span>
            <span className="font-display">AVA Statistics</span>
          </div>
          <p className="text-sm text-slate-400 mb-5">All-in-one AI voice agent platform for agencies.</p>
          <div className="flex gap-3">
            {[Twitter, Linkedin, Github].map((Ic, i) => (
              <a key={i} href="#" aria-label="social"
                className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:border-cyan-500/40 transition">
                <Ic className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
        {cols.map(c => (
          <div key={c.t}>
            <h4 className="text-white text-sm font-semibold mb-4">{c.t}</h4>
            <ul className="space-y-2.5">
              {c.l.map(it => (
                <li key={it}><a href="#" className="text-sm text-slate-400 hover:text-cyan-400 transition">{it}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <span>© 2026 AVA Statistics. All rights reserved.</span>
        <span>Made with 💙 in Canada</span>
      </div>
    </footer>
  );
};

/* ---------------------- Scroll-to-top ---------------------- */

const ScrollTop = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > window.innerHeight);
    window.addEventListener("scroll", on); return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
          className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:bg-cyan-400 transition">
          <ArrowUp className="w-5 h-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

/* ---------------------- Page ---------------------- */

const Landing = () => {
  useEffect(() => {
    document.title = "AVA Statistics — AI Voice Agent Platform for Agencies";
    const set = (selector: string, attr: string, value: string, create?: () => HTMLElement) => {
      let el = document.head.querySelector(selector) as HTMLElement | null;
      if (!el && create) { el = create(); document.head.appendChild(el); }
      el?.setAttribute(attr, value);
    };
    set('meta[name="description"]', "content",
      "All-in-one AI voice agent platform for agencies. Manage ElevenLabs, Vapi, Retell, telephony, and white-label client portals from one dashboard.",
      () => { const m = document.createElement("meta"); m.setAttribute("name", "description"); return m; });
    set('link[rel="canonical"]', "href", "https://avastatistic.ca/",
      () => { const l = document.createElement("link"); l.setAttribute("rel", "canonical"); return l; });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white antialiased font-sans">
      <Navbar />
      <main>
        <Hero />
        <ProblemSolution />
        <HowItWorks />
        <LiveDemo />
        <Features />
        <Portals />
        <Integrations />
        <Comparison />
        <Industries />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <ScrollTop />
    </div>
  );
};

export default Landing;
