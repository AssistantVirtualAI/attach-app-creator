// Shared in-memory store for reconnect / SIP diagnostics traces.
// Each reconnect attempt is a "trace" (grouped by traceId) with ordered log
// entries. The MSipDiagnostics panel subscribes and renders them.
export type SipLogLevel = "info" | "warn" | "error";
export interface SipLogEntry {
  ts: number;
  level: SipLogLevel;
  msg: string;
  data?: any;
}
export interface SipTrace {
  traceId: string;
  startedAt: number;
  finishedAt?: number;
  outcome?: "success" | "failed" | "aborted";
  entries: SipLogEntry[];
}

type Listener = () => void;

class SipDiagnosticsStore {
  private traces: SipTrace[] = [];
  private listeners = new Set<Listener>();
  private MAX_TRACES = 20;

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
  private emit() { this.listeners.forEach((l) => { try { l(); } catch {} }); }

  list(): SipTrace[] { return this.traces; }
  get(traceId: string): SipTrace | undefined { return this.traces.find((t) => t.traceId === traceId); }

  start(traceId: string): SipTrace {
    const t: SipTrace = { traceId, startedAt: Date.now(), entries: [] };
    this.traces.unshift(t);
    if (this.traces.length > this.MAX_TRACES) this.traces.length = this.MAX_TRACES;
    this.emit();
    return t;
  }
  log(traceId: string, level: SipLogLevel, msg: string, data?: any) {
    const t = this.get(traceId);
    if (!t) return;
    t.entries.push({ ts: Date.now(), level, msg, data });
    // eslint-disable-next-line no-console
    (console as any)[level === "error" ? "error" : level === "warn" ? "warn" : "log"](`[Reconnect ${traceId}] ${msg}`, data ?? "");
    this.emit();
  }
  finish(traceId: string, outcome: SipTrace["outcome"]) {
    const t = this.get(traceId);
    if (!t) return;
    t.finishedAt = Date.now();
    t.outcome = outcome;
    this.emit();
  }
  clear() { this.traces = []; this.emit(); }

  formatTrace(traceId: string): string {
    const t = this.get(traceId);
    if (!t) return "";
    const header = `TraceId: ${t.traceId}\nStarted: ${new Date(t.startedAt).toISOString()}\nOutcome: ${t.outcome ?? "in-progress"}\nDuration: ${t.finishedAt ? `${t.finishedAt - t.startedAt}ms` : "—"}\n\n`;
    const body = t.entries.map((e) => {
      const rel = e.ts - t.startedAt;
      const payload = e.data === undefined ? "" : ` ${safeJson(e.data)}`;
      return `+${String(rel).padStart(5, " ")}ms  [${e.level.toUpperCase()}] ${e.msg}${payload}`;
    }).join("\n");
    return header + body;
  }
}

function safeJson(v: any): string {
  try { return JSON.stringify(v, (_k, val) => (val instanceof Error ? { name: val.name, message: val.message } : val)); }
  catch { return String(v); }
}

export const sipDiagnostics = new SipDiagnosticsStore();
