import React, { useEffect, useState } from 'react';
import { theme } from '../lib/theme';

const { colors: c } = theme;

interface AudioOutDevice { deviceId: string; label: string }

const STORAGE_KEY = 'lemtel.audioOutput.v1';

interface Props {
  audioEl: HTMLAudioElement | null;
  compact?: boolean;
  onActiveLabel?: (label: string) => void;
  autoReset?: boolean;
  onAutoResetChange?: (v: boolean) => void;
}

/**
 * Speaker / audio output picker.
 * Uses HTMLMediaElement.setSinkId() to route call audio to the chosen device.
 * Selection is persisted in localStorage and re-applied to the <audio> element.
 */
export default function OutputDevicePicker({
  audioEl,
  compact = false,
  onActiveLabel,
  autoReset,
  onAutoResetChange,
}: Props) {
  const [devices, setDevices] = useState<AudioOutDevice[]>([]);
  const [sinkId, setSinkId] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'default'; } catch { return 'default'; }
  });
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Probe device list (re-runs on plug/unplug)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      setSupported(false);
      return;
    }
    const refresh = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const outs = all
          .filter((d) => d.kind === 'audiooutput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 6)}` }));
        setDevices(outs);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'enumerate failed');
      }
    };
    refresh();
    navigator.mediaDevices.addEventListener?.('devicechange', refresh);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', refresh);
  }, []);

  // Apply sinkId to the audio element
  useEffect(() => {
    if (!audioEl) return;
    const el = audioEl as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (typeof el.setSinkId !== 'function') { setSupported(false); return; }
    el.setSinkId(sinkId).catch((e: Error) => setError(e.message));
  }, [audioEl, sinkId]);

  // Report the human-readable label of the currently chosen device
  useEffect(() => {
    if (!onActiveLabel) return;
    const active = sinkId === 'default'
      ? 'System default'
      : devices.find((d) => d.deviceId === sinkId)?.label || 'System default';
    onActiveLabel(active);
  }, [sinkId, devices, onActiveLabel]);

  const choose = (id: string) => {
    setSinkId(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* noop */ }
  };

  if (!supported) {
    return (
      <div style={{ fontSize: 10, color: c.textDim, marginTop: 4 }} aria-live="polite">
        Speaker selection not supported in this environment.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: 280, minWidth: 0, marginBottom: 10 }}>
      <label
        htmlFor="lemtel-audio-output"
        style={{
          display: 'block', fontSize: 9, color: c.textSub,
          letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 700,
          marginBottom: 4,
        }}
      >
        🔊 Audio output
      </label>
      <select
        id="lemtel-audio-output"
        aria-label="Select audio output device"
        className="lemtel-focus"
        value={sinkId}
        onChange={(e) => choose(e.target.value)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.86)', color: c.text,
          border: '1px solid rgba(0,61,166,0.18)', borderRadius: 10,
          padding: compact ? '6px 8px' : '8px 10px',
          fontSize: compact ? 11 : 12, cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <option value="default">System default</option>
        {devices
          .filter((d) => d.deviceId && d.deviceId !== 'default')
          .map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
      </select>
      {onAutoResetChange && (
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 6, cursor: 'pointer', fontSize: 10, color: c.textSub,
            minWidth: 0,
          }}
        >
          <input
            type="checkbox"
            checked={!!autoReset}
            onChange={(e) => onAutoResetChange(e.target.checked)}
            style={{ cursor: 'pointer' }}
            aria-label="Automatically return to the default audio device after the call ends"
          />
          Return to default after call
        </label>
      )}
      {error && (
        <div style={{ fontSize: 10, color: c.red, marginTop: 4 }} role="alert">{error}</div>
      )}
    </div>
  );
}
