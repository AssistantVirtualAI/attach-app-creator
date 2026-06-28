// Live transcription pipeline for an active call.
//
// Connects to the `realtime-stt-relay` edge function over WebSocket, forwards
// PCM16LE 16kHz chunks emitted by the native plugin taps (inbound + outbound),
// and surfaces partial/final transcript segments back to the UI. Per-source
// streams keep diarization deterministic: outbound = agent, inbound = client.
//
// Usage:
//   const live = startLiveTranscription({ callRecordId, organizationId });
//   live.onSegment((seg) => ...);
//   await live.stop();

import { CapacitorSipNative } from './sip/nativeSipProvider';
import { SUPABASE_URL, getMobileSupabaseClient } from './mobileSupabase';

export type LiveSegmentStatus = 'partial' | 'final' | 'error';
export type LiveSegmentSpeaker = 'agent' | 'client' | 'unknown';

export interface LiveSegment {
  source: 'inbound' | 'outbound';
  speaker: LiveSegmentSpeaker;
  text: string;
  status: LiveSegmentStatus;
  segmentIdx: number;
  at: number;
}

export interface LiveStatusEvent {
  status: 'idle' | 'connecting' | 'live' | 'error' | 'stopped';
  message?: string;
}

export interface LiveTranscriptionHandle {
  onSegment(cb: (seg: LiveSegment) => void): () => void;
  onStatus(cb: (s: LiveStatusEvent) => void): () => void;
  stop(): Promise<void>;
}

interface StartOpts {
  callRecordId: string;
  organizationId: string;
}

const wsUrl = () =>
  SUPABASE_URL.replace(/^http/, 'ws') + '/functions/v1/realtime-stt-relay';

export function startLiveTranscription(opts: StartOpts): LiveTranscriptionHandle {
  const segListeners = new Set<(s: LiveSegment) => void>();
  const statusListeners = new Set<(s: LiveStatusEvent) => void>();
  const emitSeg = (s: LiveSegment) => segListeners.forEach((cb) => { try { cb(s); } catch {} });
  const emitStatus = (s: LiveStatusEvent) => statusListeners.forEach((cb) => { try { cb(s); } catch {} });

  let ws: WebSocket | null = null;
  let listenerInbound: { remove: () => Promise<void> } | null = null;
  let listenerOutbound: { remove: () => Promise<void> } | null = null;
  let stopped = false;

  emitStatus({ status: 'connecting' });

  (async () => {
    try {
      const supabase = getMobileSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const jwt = session?.access_token;
      if (!jwt) { emitStatus({ status: 'error', message: 'no session' }); return; }

      ws = new WebSocket(wsUrl());
      ws.onopen = () => {
        ws!.send(JSON.stringify({
          type: 'init',
          call_record_id: opts.callRecordId,
          organization_id: opts.organizationId,
          jwt,
        }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
          if (msg.type === 'ready') {
            emitStatus({ status: 'live' });
            // Turn on native audio taps once relay is ready.
            CapacitorSipNative.setLiveTranscriptionEnabled({ enabled: true })
              .catch(() => {});
          } else if (msg.type === 'segment') {
            emitSeg({
              source: msg.source,
              speaker: msg.source === 'outbound' ? 'agent' : 'client',
              text: String(msg.text || ''),
              status: msg.status as LiveSegmentStatus,
              segmentIdx: Number(msg.segment_idx || 0),
              at: Date.now(),
            });
          } else if (msg.type === 'error') {
            emitStatus({ status: 'error', message: String(msg.message || 'relay error') });
          }
        } catch {}
      };
      ws.onerror = () => emitStatus({ status: 'error', message: 'ws error' });
      ws.onclose = () => { if (!stopped) emitStatus({ status: 'stopped' }); };

      // Wire native taps -> WS.
      listenerInbound = await CapacitorSipNative.addListener('livePcmInbound', (data: any) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const b64 = data?.b64; if (!b64) return;
        try { ws.send(JSON.stringify({ type: 'pcm', source: 'inbound', b64 })); } catch {}
      });
      listenerOutbound = await CapacitorSipNative.addListener('livePcmOutbound', (data: any) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const b64 = data?.b64; if (!b64) return;
        try { ws.send(JSON.stringify({ type: 'pcm', source: 'outbound', b64 })); } catch {}
      });
    } catch (e: any) {
      emitStatus({ status: 'error', message: e?.message || 'init failed' });
    }
  })();

  return {
    onSegment(cb) { segListeners.add(cb); return () => segListeners.delete(cb); },
    onStatus(cb) { statusListeners.add(cb); return () => statusListeners.delete(cb); },
    async stop() {
      stopped = true;
      try { await CapacitorSipNative.setLiveTranscriptionEnabled({ enabled: false }); } catch {}
      try { await listenerInbound?.remove(); } catch {}
      try { await listenerOutbound?.remove(); } catch {}
      try { ws?.send(JSON.stringify({ type: 'close' })); } catch {}
      try { ws?.close(); } catch {}
      emitStatus({ status: 'stopped' });
    },
  };
}
