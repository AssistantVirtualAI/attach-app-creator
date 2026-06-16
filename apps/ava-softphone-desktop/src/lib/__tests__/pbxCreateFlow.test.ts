// End-to-end coverage for the guarded PBX create flow used by Extensions,
// Auto-Attendants (IVR), and Call Queues in the desktop Admin view.
//
// Verifies:
//   1. Non-admin users cannot submit (submit() never called); denial audited.
//   2. Duplicate detection records audit (with timestamp, kind, id, remote
//      version, idempotency key, resolution choice) and opens existing for
//      edit when the user confirms.
//   3. On success, dispatchSaved AND toastSuccess fire ONLY after reload(true)
//      resolves — and dispatchSaved fires BEFORE toastSuccess.
//   4. The `ava:pbx-resource-saved` event reaches every listener.
//   5. Idempotency keys: repeated submits with the same key short-circuit
//      into an audited replay and DO NOT call submit a second time.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCreatePbxResourceFlow, generateIdempotencyKey, __resetIdempotencyCacheForTests, type CreateFlowDeps } from '../pbxCreateFlow';

const win = new EventTarget() as any;
win.dispatchEvent = win.dispatchEvent.bind(win);
win.addEventListener = win.addEventListener.bind(win);
win.removeEventListener = win.removeEventListener.bind(win);
(globalThis as any).window = win;

function makeDeps(overrides: Partial<CreateFlowDeps> = {}): CreateFlowDeps {
  return {
    isAdmin: true,
    resourceKind: 'extension',
    identifier: '1001',
    findDuplicate: vi.fn(async () => null),
    confirmConflict: vi.fn(() => false),
    openForEdit: vi.fn(),
    submit: vi.fn(async () => {}),
    reload: vi.fn(async () => {}),
    dispatchSaved: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    audit: vi.fn(),
    ...overrides,
  };
}

describe('runCreatePbxResourceFlow', () => {
  beforeEach(() => { vi.clearAllMocks(); __resetIdempotencyCacheForTests(); });

  it('blocks non-admin users from submitting and audits the denial', async () => {
    const deps = makeDeps({ isAdmin: false });
    const result = await runCreatePbxResourceFlow(deps, 'ok');

    expect(result).toEqual({ status: 'denied_non_admin' });
    expect(deps.submit).not.toHaveBeenCalled();
    expect(deps.reload).not.toHaveBeenCalled();
    expect(deps.toastSuccess).not.toHaveBeenCalled();
    expect(deps.toastError).toHaveBeenCalledWith(expect.stringContaining('Admin role required'));
    expect(deps.audit).toHaveBeenCalledWith(
      'pbx.create_denied_non_admin',
      expect.objectContaining({ resource: 'extension', identifier: '1001', at: expect.any(String) }),
    );
  });

  it('records duplicate + resolution audit and opens existing record for edit', async () => {
    const existing = { id: 'row-9', pbx_uuid: 'pbx-9', updated_at: '2026-06-01T12:00:00Z' };
    const deps = makeDeps({
      findDuplicate: vi.fn(async () => existing),
      confirmConflict: vi.fn(() => true),
    });

    const result = await runCreatePbxResourceFlow(deps, 'ok');

    expect(result).toEqual({ status: 'duplicate_opened_for_edit', existing });
    expect(deps.submit).not.toHaveBeenCalled();
    expect(deps.openForEdit).toHaveBeenCalledWith(existing);

    const calls = (deps.audit as any).mock.calls;
    const detected = calls.find((c: any[]) => c[0] === 'pbx.create_duplicate_detected');
    const resolved = calls.find((c: any[]) => c[0] === 'pbx.create_conflict_resolved');
    expect(detected[1]).toMatchObject({
      resource: 'extension', identifier: '1001',
      remote_id: 'row-9', remote_version: '2026-06-01T12:00:00Z',
    });
    expect(detected[1].at).toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(detected[1].idempotency_key).toBeTruthy();
    expect(resolved[1]).toMatchObject({ remote_id: 'row-9', resolution: 'open_for_edit' });
  });

  it('records abort resolution when user cancels duplicate prompt', async () => {
    const deps = makeDeps({
      findDuplicate: vi.fn(async () => ({ id: 'x', updated_at: 'v1' })),
      confirmConflict: vi.fn(() => false),
    });
    const result = await runCreatePbxResourceFlow(deps, 'ok');
    expect(result.status).toBe('duplicate_aborted');
    expect(deps.openForEdit).not.toHaveBeenCalled();
    expect(deps.submit).not.toHaveBeenCalled();
    const resolved = (deps.audit as any).mock.calls.find((c: any[]) => c[0] === 'pbx.create_conflict_resolved');
    expect(resolved[1].resolution).toBe('abort');
  });

  it('fires success toast AND dispatchSaved strictly AFTER reload(true) — toast comes last', async () => {
    const order: string[] = [];
    let reloadResolve!: () => void;
    const reloadDone = new Promise<void>((r) => { reloadResolve = r; });

    const deps = makeDeps({
      submit: vi.fn(async () => { order.push('submit'); }),
      reload: vi.fn(async (force: boolean) => {
        order.push(`reload:${force}:start`);
        await reloadDone;
        order.push(`reload:${force}:end`);
      }),
      dispatchSaved: vi.fn(() => { order.push('dispatch'); }),
      toastSuccess: vi.fn(() => { order.push('toast'); }),
    });

    const p = runCreatePbxResourceFlow(deps, 'Created.');

    // While reload is pending: submit started, reload started, but NO toast/dispatch yet.
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(order).toEqual(['submit', 'reload:true:start']);
    expect(deps.toastSuccess).not.toHaveBeenCalled();
    expect(deps.dispatchSaved).not.toHaveBeenCalled();

    reloadResolve();
    await p;

    expect(order).toEqual(['submit', 'reload:true:start', 'reload:true:end', 'dispatch', 'toast']);
    expect(deps.toastSuccess).toHaveBeenCalledWith('Created.');
  });

  it('dispatches ava:pbx-resource-saved to every listener after create', async () => {
    const received: string[] = [];
    const handlers = ['viewA', 'viewB', 'viewC'].map((tag) => {
      const h = () => received.push(tag);
      window.addEventListener('ava:pbx-resource-saved', h);
      return [tag, h] as const;
    });

    const deps = makeDeps({
      dispatchSaved: () => window.dispatchEvent(new Event('ava:pbx-resource-saved')),
    });

    const result = await runCreatePbxResourceFlow(deps, 'ok');
    expect(result.status).toBe('created');
    expect(received).toEqual(['viewA', 'viewB', 'viewC']);

    handlers.forEach(([, h]) => window.removeEventListener('ava:pbx-resource-saved', h));
  });

  it('idempotent replay: same key on a second submit skips submit and audits replay', async () => {
    const key = generateIdempotencyKey();
    const deps1 = makeDeps({ idempotencyKey: key });
    const r1 = await runCreatePbxResourceFlow(deps1, 'ok');
    expect(r1.status).toBe('created');
    expect(deps1.submit).toHaveBeenCalledTimes(1);

    // Replay with the SAME key — submit must NOT be invoked again.
    const deps2 = makeDeps({ idempotencyKey: key });
    const r2 = await runCreatePbxResourceFlow(deps2, 'ok');
    expect(r2).toEqual({ status: 'idempotent_replay', idempotencyKey: key });
    expect(deps2.submit).not.toHaveBeenCalled();
    expect(deps2.reload).not.toHaveBeenCalled();
    expect(deps2.toastSuccess).not.toHaveBeenCalled();
    expect(deps2.audit).toHaveBeenCalledWith(
      'pbx.create_idempotent_replay',
      expect.objectContaining({ resource: 'extension', identifier: '1001', idempotency_key: key }),
    );
  });

  it('toasts error and skips success/dispatch when submit throws', async () => {
    const deps = makeDeps({
      submit: vi.fn(async () => { throw new Error('boom'); }),
    });
    const result = await runCreatePbxResourceFlow(deps, 'ok');
    expect(result).toEqual({ status: 'error', error: 'boom' });
    expect(deps.reload).not.toHaveBeenCalled();
    expect(deps.dispatchSaved).not.toHaveBeenCalled();
    expect(deps.toastSuccess).not.toHaveBeenCalled();
    expect(deps.toastError).toHaveBeenCalledWith('Create failed: boom');
  });
});
