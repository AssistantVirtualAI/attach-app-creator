/**
 * Phase 5 — offline-first recording cache.
 *
 * Resolves a playable URL for a recording, preferring a previously-downloaded
 * local copy. If absent, fetches the short-lived signed URL from the backend,
 * streams the bytes onto disk (native) or into a Blob (web), and returns a
 * local/object URL that does not expire and works offline.
 */
import { Capacitor } from '@capacitor/core';
import { loadPbxRecordingAudioMobile } from './mobileSupabase';

const META_KEY_PREFIX = 'ava.recordingCache.v1.';

type RecMeta = {
  recording_path?: string | null;
  recording_name?: string | null;
  xml_cdr_uuid?: string | null;
  domain_uuid?: string | null;
  domain_name?: string | null;
  organization_id?: string | null;
  start_at?: string | null;
};

function safeName(id: string) {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_') + '.audio';
}

async function getCachedNativePath(id: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Filesystem, Directory } = await import(/* @vite-ignore */ '@capacitor/filesystem');
    const path = `recordings/${safeName(id)}`;
    await Filesystem.stat({ path, directory: Directory.Data });
    const uri = await Filesystem.getUri({ path, directory: Directory.Data });
    return Capacitor.convertFileSrc(uri.uri);
  } catch {
    return null;
  }
}

const webBlobCache = new Map<string, string>();

export async function getCachedRecordingUrl(id: string): Promise<string | null> {
  if (Capacitor.isNativePlatform()) return getCachedNativePath(id);
  return webBlobCache.get(id) || null;
}

/**
 * Download + cache the recording. Returns a playable URL.
 * Reuses an existing cached copy if present (force=true to bypass).
 */
export async function downloadRecording(
  id: string,
  meta: RecMeta,
  accessToken: string | null,
  organizationId: string | null,
  domainUuidFallback: string | null,
  opts: { force?: boolean } = {},
): Promise<string> {
  if (!opts.force) {
    const existing = await getCachedRecordingUrl(id);
    if (existing) return existing;
  }

  const signedUrl = await loadPbxRecordingAudioMobile(
    {
      id,
      xml_cdr_uuid: meta.xml_cdr_uuid || undefined,
      recording_path: meta.recording_path || undefined,
      recording_name: meta.recording_name || undefined,
      domain_uuid: meta.domain_uuid || undefined,
      domain_name: meta.domain_name || undefined,
      organization_id: meta.organization_id || undefined,
      start_at: meta.start_at || undefined,
    },
    accessToken,
    organizationId,
    domainUuidFallback,
  );

  const resp = await fetch(signedUrl);
  if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status}`);
  const blob = await resp.blob();

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import(/* @vite-ignore */ '@capacitor/filesystem');
    const buf = await blob.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    try { await Filesystem.mkdir({ path: 'recordings', directory: Directory.Data, recursive: true }); } catch {}
    const path = `recordings/${safeName(id)}`;
    await Filesystem.writeFile({ path, directory: Directory.Data, data: b64 });
    try { localStorage.setItem(META_KEY_PREFIX + id, JSON.stringify({ at: Date.now(), size: buf.byteLength })); } catch {}
    const uri = await Filesystem.getUri({ path, directory: Directory.Data });
    return Capacitor.convertFileSrc(uri.uri);
  } else {
    const url = URL.createObjectURL(blob);
    const prev = webBlobCache.get(id);
    if (prev) { try { URL.revokeObjectURL(prev); } catch {} }
    webBlobCache.set(id, url);
    return url;
  }
}

/**
 * Best-effort warm-up: pre-fetch multiple recordings in the background.
 * Failures are swallowed so the UI never blocks on prefetch.
 */
export async function prefetchRecordings(
  items: Array<{ id: string; meta: RecMeta }>,
  accessToken: string | null,
  organizationId: string | null,
  domainUuidFallback: string | null,
  opts: { concurrency?: number } = {},
): Promise<void> {
  const concurrency = Math.max(1, Math.min(4, opts.concurrency ?? 2));
  let i = 0;
  const workers: Promise<void>[] = [];
  for (let k = 0; k < concurrency; k++) {
    workers.push((async () => {
      while (i < items.length) {
        const idx = i++;
        const it = items[idx];
        try {
          const cached = await getCachedRecordingUrl(it.id);
          if (cached) continue;
          await downloadRecording(it.id, it.meta, accessToken, organizationId, domainUuidFallback);
        } catch { /* ignore */ }
      }
    })());
  }
  await Promise.all(workers);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}
