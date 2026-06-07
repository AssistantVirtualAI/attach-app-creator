// Best-effort media permission bootstrapper.
// Triggers the browser/OS prompt for microphone (required for SIP calls),
// camera (optional, future video), and probes speaker enumeration so the
// output-device picker shows real labels instead of generic IDs.
export async function requestMediaPermissions(): Promise<{
  microphone: PermissionState | 'unknown';
  camera: PermissionState | 'unknown';
  speaker: 'ok' | 'unavailable';
}> {
  const result = {
    microphone: 'unknown' as PermissionState | 'unknown',
    camera: 'unknown' as PermissionState | 'unknown',
    speaker: 'unavailable' as 'ok' | 'unavailable',
  };

  if (typeof navigator === 'undefined' || !navigator.mediaDevices) return result;

  // Microphone — required.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    result.microphone = 'granted';
  } catch {
    result.microphone = 'denied';
  }

  // Camera — optional; ignore failures silently.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    result.camera = 'granted';
  } catch {
    result.camera = 'denied';
  }

  // Speaker — verify enumeration works (no explicit permission on most OSes).
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (devices.some((d) => d.kind === 'audiooutput')) result.speaker = 'ok';
  } catch {
    /* noop */
  }

  return result;
}
