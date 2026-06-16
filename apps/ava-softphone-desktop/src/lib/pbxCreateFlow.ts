// Shared create-flow helper for desktop admin PBX resources (extensions, IVRs,
// call queues). Centralizes:
//   • admin-only gating (rejects non-admin submits even if the button is hidden)
//   • duplicate / remote-conflict detection BEFORE invoking fusionpbx-proxy
//   • idempotency keys — repeated submits with the same key short-circuit
//     into an audited "idempotent_replay" instead of creating duplicates
//   • audit logging (denials, duplicates, conflict resolutions, replays, successes)
//   • reload-then-toast ordering (toast.success only fires AFTER reload(true)
//     finishes — guarantees the UI is refreshed before user feedback)
//   • dispatch of `ava:pbx-resource-saved` so every mounted view re-fetches
//
// Pure-ish: all side effects (audit, toast, dispatch, supabase call, reload)
// are injected so the helper is exhaustively unit-testable.

export type CreateFlowAuditAction =
  | 'pbx.create_denied_non_admin'
  | 'pbx.create_duplicate_detected'
  | 'pbx.create_conflict_resolved'
  | 'pbx.create_idempotent_replay'
  | 'pbx.create_succeeded';

export type CreateFlowDeps = {
  isAdmin: boolean;
  resourceKind: 'extension' | 'ivr' | 'queue';
  identifier: string;
  /** Stable key (UUID) for this submission. Repeated submits sharing the same
   *  key are detected as idempotent replays and skipped. Optional — when omitted
   *  the flow generates one but cannot detect cross-submit replays. */
  idempotencyKey?: string;
  findDuplicate: () => Promise<any | null>;
  /** Prompt the user to resolve a duplicate. Return true → open existing,
   *  false → abort. May be sync or async. */
  confirmConflict: (existing: any) => Promise<boolean> | boolean;
  openForEdit: (existing: any) => void;
  submit: (ctx: { idempotencyKey: string }) => Promise<void>;
  reload: (forceSync: boolean) => Promise<void>;
  dispatchSaved: () => void;
  toastSuccess: (msg: string) => void;
  toastError: (msg: string) => void;
  audit: (action: CreateFlowAuditAction, metadata: Record<string, unknown>) => void;
};

export type CreateFlowResult =
  | { status: 'denied_non_admin' }
  | { status: 'duplicate_aborted'; existing: any }
  | { status: 'duplicate_opened_for_edit'; existing: any }
  | { status: 'idempotent_replay'; idempotencyKey: string }
  | { status: 'created'; idempotencyKey: string }
  | { status: 'error'; error: string };

// Module-level idempotency cache: keys we've already processed to completion.
// TTL'd to keep memory bounded; 5 min is far longer than any reasonable UI
// double-submit window.
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const seenKeys = new Map<string, number>();
function pruneSeenKeys() {
  const now = Date.now();
  for (const [k, ts] of seenKeys) if (now - ts > IDEMPOTENCY_TTL_MS) seenKeys.delete(k);
}

/** Generate a stable per-submission idempotency key. */
export function generateIdempotencyKey(): string {
  try { return (globalThis as any).crypto?.randomUUID?.() || `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  catch { return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

/** Test-only: clear the seen-keys cache between tests. */
export function __resetIdempotencyCacheForTests() { seenKeys.clear(); }

export async function runCreatePbxResourceFlow(
  deps: CreateFlowDeps,
  successMessage: string,
): Promise<CreateFlowResult> {
  const now = () => new Date().toISOString();
  const idempotencyKey = deps.idempotencyKey || generateIdempotencyKey();

  if (!deps.isAdmin) {
    deps.audit('pbx.create_denied_non_admin', {
      resource: deps.resourceKind,
      identifier: deps.identifier,
      idempotency_key: idempotencyKey,
      at: now(),
    });
    deps.toastError(`Admin role required to create ${deps.resourceKind}s.`);
    return { status: 'denied_non_admin' };
  }

  // Idempotency replay short-circuit: if this exact key was already processed
  // to a success in this session, the user has double-submitted. Audit and
  // skip — do NOT call submit, do NOT toast a second success.
  pruneSeenKeys();
  if (seenKeys.has(idempotencyKey)) {
    deps.audit('pbx.create_idempotent_replay', {
      resource: deps.resourceKind,
      identifier: deps.identifier,
      idempotency_key: idempotencyKey,
      at: now(),
    });
    return { status: 'idempotent_replay', idempotencyKey };
  }

  // Duplicate / remote conflict pre-check.
  let existing: any = null;
  try { existing = await deps.findDuplicate(); }
  catch { existing = null; /* backend UNIQUE is canonical */ }
  if (existing) {
    const remoteVersion =
      existing.updated_at || existing.modified_date || existing.pbx_uuid || existing.id || null;
    deps.audit('pbx.create_duplicate_detected', {
      resource: deps.resourceKind,
      identifier: deps.identifier,
      remote_id: existing.id || existing.pbx_uuid || null,
      remote_version: remoteVersion,
      idempotency_key: idempotencyKey,
      at: now(),
    });
    const openIt = await Promise.resolve(deps.confirmConflict(existing));
    deps.audit('pbx.create_conflict_resolved', {
      resource: deps.resourceKind,
      identifier: deps.identifier,
      remote_id: existing.id || existing.pbx_uuid || null,
      remote_version: remoteVersion,
      resolution: openIt ? 'open_for_edit' : 'abort',
      idempotency_key: idempotencyKey,
      at: now(),
    });
    if (openIt) {
      deps.openForEdit(existing);
      return { status: 'duplicate_opened_for_edit', existing };
    }
    return { status: 'duplicate_aborted', existing };
  }

  // No duplicate → submit, then reload BEFORE toasting success.
  try {
    await deps.submit({ idempotencyKey });
    await deps.reload(true); // must complete before toast
    deps.dispatchSaved();
    seenKeys.set(idempotencyKey, Date.now());
    deps.audit('pbx.create_succeeded', {
      resource: deps.resourceKind,
      identifier: deps.identifier,
      idempotency_key: idempotencyKey,
      at: now(),
    });
    deps.toastSuccess(successMessage);
    return { status: 'created', idempotencyKey };
  } catch (e: any) {
    const msg = e?.message || 'unknown';
    deps.toastError(`Create failed: ${msg}`);
    return { status: 'error', error: msg };
  }
}
