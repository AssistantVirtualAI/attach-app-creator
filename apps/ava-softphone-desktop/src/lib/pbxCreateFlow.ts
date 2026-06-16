// Shared create-flow helper for desktop admin PBX resources (extensions, IVRs,
// call queues). Centralizes:
//   • admin-only gating (rejects non-admin submits even if the button is hidden)
//   • duplicate / remote-conflict detection BEFORE invoking fusionpbx-proxy
//   • audit logging (denials, duplicates, conflict resolutions, successes)
//   • reload-then-toast ordering (toast.success is only fired AFTER reload(true)
//     finishes — guarantees the UI is refreshed before user feedback)
//   • dispatch of `ava:pbx-resource-saved` so every mounted view re-fetches
//
// Pure-ish: all side effects (audit, toast, dispatch, supabase call, reload)
// are injected so the helper is exhaustively unit-testable.

export type CreateFlowDeps = {
  isAdmin: boolean;
  resourceKind: 'extension' | 'ivr' | 'queue';
  /** Human-readable identifier for the resource (e.g. extension number or name). */
  identifier: string;
  /** Lookup an existing record with the same identifier. Returns the matched
   *  row (any shape) or null when no duplicate exists. */
  findDuplicate: () => Promise<any | null>;
  /** Prompt the user to resolve a duplicate. Return true → open existing for
   *  edit, false → abort the create entirely. */
  confirmConflict: (existing: any) => Promise<boolean> | boolean;
  /** Invoked when the user chooses to open the existing record for edit. */
  openForEdit: (existing: any) => void;
  /** Submit the create payload to the backend (fusionpbx-proxy). */
  submit: () => Promise<void>;
  /** Refresh local state from the source of truth; resolves AFTER the new row
   *  is visible. The success toast is fired strictly after this resolves. */
  reload: (forceSync: boolean) => Promise<void>;
  /** Dispatch the cross-view sync event. */
  dispatchSaved: () => void;
  /** Show feedback to the user. */
  toastSuccess: (msg: string) => void;
  toastError: (msg: string) => void;
  /** Fire-and-forget structured audit. */
  audit: (
    action:
      | 'pbx.create_denied_non_admin'
      | 'pbx.create_duplicate_detected'
      | 'pbx.create_conflict_resolved'
      | 'pbx.create_succeeded',
    metadata: Record<string, unknown>,
  ) => void;
};

export type CreateFlowResult =
  | { status: 'denied_non_admin' }
  | { status: 'duplicate_aborted'; existing: any }
  | { status: 'duplicate_opened_for_edit'; existing: any }
  | { status: 'created' }
  | { status: 'error'; error: string };

/**
 * Run the full guarded create flow.
 *
 * Ordering guarantees (verified by tests):
 *   1. Non-admin → audit + error toast, NO submit, NO toast.success.
 *   2. Duplicate found → audit, prompt user; submit is NEVER called.
 *   3. On success → submit → reload(true) → dispatchSaved → toast.success.
 *      reload MUST resolve before toast.success fires.
 */
export async function runCreatePbxResourceFlow(
  deps: CreateFlowDeps,
  successMessage: string,
): Promise<CreateFlowResult> {
  const now = () => new Date().toISOString();

  if (!deps.isAdmin) {
    deps.audit('pbx.create_denied_non_admin', {
      resource: deps.resourceKind,
      identifier: deps.identifier,
      at: now(),
    });
    deps.toastError(`Admin role required to create ${deps.resourceKind}s.`);
    return { status: 'denied_non_admin' };
  }

  // Duplicate / remote conflict pre-check.
  let existing: any = null;
  try {
    existing = await deps.findDuplicate();
  } catch {
    // Duplicate detection is best-effort. If the lookup itself fails we fall
    // through and let the backend reject (its UNIQUE constraint is canonical).
    existing = null;
  }
  if (existing) {
    const remoteVersion =
      existing.updated_at ||
      existing.modified_date ||
      existing.pbx_uuid ||
      existing.id ||
      null;
    deps.audit('pbx.create_duplicate_detected', {
      resource: deps.resourceKind,
      identifier: deps.identifier,
      remote_id: existing.id || existing.pbx_uuid || null,
      remote_version: remoteVersion,
      at: now(),
    });
    const openIt = await Promise.resolve(deps.confirmConflict(existing));
    deps.audit('pbx.create_conflict_resolved', {
      resource: deps.resourceKind,
      identifier: deps.identifier,
      remote_id: existing.id || existing.pbx_uuid || null,
      remote_version: remoteVersion,
      resolution: openIt ? 'open_for_edit' : 'abort',
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
    await deps.submit();
    await deps.reload(true); // must complete before toast
    deps.dispatchSaved();
    deps.audit('pbx.create_succeeded', {
      resource: deps.resourceKind,
      identifier: deps.identifier,
      at: now(),
    });
    deps.toastSuccess(successMessage);
    return { status: 'created' };
  } catch (e: any) {
    const msg = e?.message || 'unknown';
    deps.toastError(`Create failed: ${msg}`);
    return { status: 'error', error: msg };
  }
}
