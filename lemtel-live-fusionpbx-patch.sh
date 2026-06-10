#!/usr/bin/env bash
# ============================================================
# Lemtel / AVA — Patch branchement live FusionPBX
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
DESKTOP="$REPO_ROOT/apps/ava-softphone-desktop/src/lib/avaApi.ts"
MOBILE="$REPO_ROOT/apps/ava-softphone-mobile/src/lib/mobileApi.ts"
TS=$(date +%Y%m%d_%H%M%S)

echo "=== Lemtel Live FusionPBX Patch ==="
echo "Répertoire : $REPO_ROOT"

# ── Vérifications ────────────────────────────────────────────
if [ ! -f "$DESKTOP" ]; then
  echo "ERREUR : fichier introuvable → $DESKTOP"
  exit 1
fi
if [ ! -f "$MOBILE" ]; then
  echo "ERREUR : fichier introuvable → $MOBILE"
  exit 1
fi

# ── Sauvegardes ──────────────────────────────────────────────
cp "$DESKTOP" "${DESKTOP}.bak_${TS}"
cp "$MOBILE"  "${MOBILE}.bak_${TS}"
echo "✅ Sauvegardes créées : *.bak_${TS}"

# ============================================================
# PATCH 1 — Desktop : apps/ava-softphone-desktop/src/lib/avaApi.ts
# ============================================================
echo ""
echo "--- Patch Desktop avaApi.ts ---"

python3 - "$DESKTOP" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

original = src

# 1. MOCK configurable via VITE_AVA_MOCK (live par défaut)
src = re.sub(
    r'export const MOCK\s*=\s*true\s*;',
    "export const MOCK: boolean = (import.meta as any).env?.VITE_AVA_MOCK === 'true';",
    src
)

# 2. resolveUrl — conserver les query params pour get-recording
old_resolve = r'''function resolveUrl\(path: string\): string \{
  if \(path\.startsWith\('/fn/'\)\) return fnUrl\(path\.slice\(4\)\.split\('\?'\)\[0\]\);'''
new_resolve = """function resolveUrl(path: string): string {
  if (path.startsWith('/fn/')) {
    const [fnPath, qs] = path.slice(4).split('?');
    const base = fnUrl(fnPath);
    return qs ? `${base}?${qs}` : base;
  }"""
src = re.sub(old_resolve, new_resolve, src, flags=re.DOTALL)

# 3. Mappeurs CDR → UI (insérés juste avant "export const ava")
mappers = '''
/* ─── Mappeurs CDR FusionPBX → UI ─────────────────────────── */
function mapCdrToCall(r: any): CallRecord {
  const billsec = Number(r.billsec ?? r.duration_seconds ?? 0);
  const missed  = r.missed_call || r.hangup_cause === 'NO_ANSWER' || billsec === 0;
  return {
    id:           r.id ?? r.pbx_uuid ?? String(Math.random()),
    direction:    (r.direction === 'outbound' ? 'out' : 'in') as 'in' | 'out',
    status:       (r.voicemail_message ? 'voicemail' : missed ? 'missed' : 'answered') as any,
    from:         r.caller_number ?? '',
    to:           r.destination_number ?? '',
    customer:     r.caller_name ?? undefined,
    startedAt:    r.start_at ?? new Date().toISOString(),
    durationSec:  billsec,
    hasRecording: !!(r.has_recording || r.recording_path || r.recording_name),
    hasTranscript: false,
    sentiment:    undefined,
  };
}

function mapCdrToVoicemail(r: any): VoicemailItem {
  return {
    id:          r.id ?? r.pbx_uuid ?? String(Math.random()),
    from:        r.caller_number ?? '',
    customer:    r.caller_name ?? undefined,
    receivedAt:  r.start_at ?? new Date().toISOString(),
    durationSec: Number(r.billsec ?? r.duration_seconds ?? 0),
    isNew:       !r.voicemail_read,
    transcript:  r.voicemail_message ?? 'Transcription non disponible.',
    summary:     r.voicemail_message
                   ? r.voicemail_message.slice(0, 120) + (r.voicemail_message.length > 120 ? '…' : '')
                   : 'Aucun résumé disponible.',
    sentiment:   'neutral' as const,
    priority:    'normal' as const,
    handled:     false,
    feedback:    null,
  };
}

function mapCdrToRecording(r: any): RecordingItem {
  return {
    id:          r.id ?? r.pbx_uuid ?? String(Math.random()),
    callId:      r.id ?? '',
    from:        r.caller_number ?? '',
    to:          r.destination_number ?? '',
    customer:    r.caller_name ?? undefined,
    recordedAt:  r.start_at ?? new Date().toISOString(),
    durationSec: Number(r.billsec ?? r.duration_seconds ?? 0),
    sizeKb:      0,
    qualityScore: 0,
    sentiment:   'neutral' as const,
    summary:     'Enregistrement disponible.',
    topics:      [],
    tags:        [],
    feedback:    null,
  };
}

'''

if 'mapCdrToCall' not in src:
    src = re.sub(r'(export const ava\s*=\s*\{)', mappers + r'\1', src)
    print('  ✅ Mappeurs CDR ajoutés')
else:
    print('  ⏭  Mappeurs CDR déjà présents')

# 4. Remplacer les anciens appels "op:" par les actions réelles
replacements = [
    # voicemails
    (
        r"voicemails:\s*\(\)\s*=>\s*call<VoicemailItem\[\]>\([^,]+,\s*\{[^}]+\},[^)]+\)",
        """voicemails: () => call<VoicemailItem[]>(
    `/fn/${FN.fusionpbxProxy}`,
    { method: 'POST', body: JSON.stringify({ action: 'sync-cdrs', limit: 50 }) },
    MOCK_VM
  ).then(async (raw: any) => {
    if (MOCK || !Array.isArray(raw?.rows ?? raw)) return raw as VoicemailItem[];
    const rows = raw?.rows ?? raw;
    return rows
      .filter((r: any) => r.voicemail_message || r.missed_call)
      .map(mapCdrToVoicemail);
  })"""
    ),
    # recordings
    (
        r"recordings:\s*\(\)\s*=>\s*call<RecordingItem\[\]>\([^,]+,\s*\{[^}]+\},[^)]+\)",
        """recordings: () => call<RecordingItem[]>(
    `/fn/${FN.fusionpbxProxy}`,
    { method: 'POST', body: JSON.stringify({ action: 'sync-cdrs', limit: 100 }) },
    MOCK_RECORDINGS
  ).then(async (raw: any) => {
    if (MOCK || !Array.isArray(raw?.rows ?? raw)) return raw as RecordingItem[];
    const rows = raw?.rows ?? raw;
    return rows.filter((r: any) => r.has_recording || r.recording_path).map(mapCdrToRecording);
  })"""
    ),
    # calls
    (
        r"calls:\s*\(limit\s*=\s*50\)\s*=>\s*call<CallRecord\[\]>\([^,]+,[^,]+,[^)]+\)",
        """calls: (limit = 50) => call<CallRecord[]>(
    `/fn/${FN.fusionpbxProxy}`,
    { method: 'POST', body: JSON.stringify({ action: 'sync-cdrs', limit }) },
    MOCK_CALLS
  ).then(async (raw: any) => {
    if (MOCK || !Array.isArray(raw?.rows ?? raw)) return raw as CallRecord[];
    return (raw?.rows ?? raw).map(mapCdrToCall);
  })"""
    ),
]

for pattern, replacement in replacements:
    new_src, n = re.subn(pattern, replacement, src, flags=re.DOTALL)
    if n:
        src = new_src
        print(f'  ✅ Remplacement effectué ({n})')
    else:
        print(f'  ⚠️  Pattern non trouvé — vérification manuelle requise')

# 5. setAuthToken appelé dans le module lui-même
auth_patch = '''
/* ─── Initialisation du token depuis la session Supabase ───── */
import { supabase as _sb } from './supabaseClient';
(async () => {
  const { data: { session } } = await _sb.auth.getSession();
  if (session?.access_token) setAuthToken(session.access_token);
  _sb.auth.onAuthStateChange((_ev, s) => setAuthToken(s?.access_token ?? null));
})();

'''

if 'onAuthStateChange' not in src and 'supabaseClient' not in src:
    src = src + auth_patch
    print('  ✅ Auto-init token ajouté')
else:
    print('  ⏭  Auto-init token déjà présent')

if src != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    print('  ✅ avaApi.ts mis à jour')
else:
    print('  ⏭  Aucune modification nécessaire dans avaApi.ts')
PYEOF

# ============================================================
# PATCH 2 — Mobile : apps/ava-softphone-mobile/src/lib/mobileApi.ts
# ============================================================
echo ""
echo "--- Patch Mobile mobileApi.ts ---"

python3 - "$MOBILE" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

original = src

# 1. Mappeurs CDR → CallRecord et VoicemailEntry
mappers = '''
/* ─── Mappeurs CDR FusionPBX ──────────────────────────────── */
function mapCdrToCallRecord(r: any): CallRecord {
  const billsec = Number(r.billsec ?? r.duration_seconds ?? 0);
  const missed  = r.missed_call || r.hangup_cause === 'NO_ANSWER' || billsec === 0;
  return {
    id:           r.id ?? String(Math.random()),
    direction:    (r.direction === 'outbound' ? 'out' : 'in') as 'in' | 'out',
    status:       (r.voicemail_message ? 'voicemail' : missed ? 'missed' : 'answered') as any,
    from:         r.caller_number ?? '',
    to:           r.destination_number ?? '',
    customer:     r.caller_name ?? undefined,
    startedAt:    r.start_at ?? new Date().toISOString(),
    durationSec:  billsec,
    hasRecording: !!(r.has_recording || r.recording_path || r.recording_name),
    hasTranscript: false,
    sentiment:    undefined,
  };
}

function mapCdrToVoicemailEntry(r: any): VoicemailEntry {
  return {
    id:          r.id ?? String(Math.random()),
    from:        r.caller_number ?? '',
    customer:    r.caller_name ?? undefined,
    receivedAt:  r.start_at ?? new Date().toISOString(),
    durationSec: Number(r.billsec ?? r.duration_seconds ?? 0),
    transcript:  r.voicemail_message ?? 'Transcription non disponible.',
    summary:     r.voicemail_message
                   ? r.voicemail_message.slice(0, 120)
                   : 'Aucun résumé disponible.',
    priority:    'normal' as const,
    sentiment:   'neutral' as const,
    isNew:       !r.voicemail_read,
  };
}

'''

if 'mapCdrToCallRecord' not in src:
    src = re.sub(r'(export const mobileApi\s*=\s*\{)', mappers + r'\1', src)
    print('  ✅ Mappeurs mobile ajoutés')
else:
    print('  ⏭  Mappeurs mobile déjà présents')

# 2. calls() — remplace /mobile-calls par fusionpbx-proxy action:list-cdrs
old_calls = r"calls:\s*\(\)\s*=>\s*call<CallRecord\[\]>\('/mobile-calls'[^)]+\)"
new_calls = """calls: () => call<CallRecord[]>(
    '/fusionpbx-proxy',
    { method: 'POST', body: JSON.stringify({ action: 'sync-cdrs', limit: 50 }) },
    callsMock
  ).then((raw: any) => {
    if (!Array.isArray(raw?.rows ?? raw)) return callsMock;
    return (raw?.rows ?? raw).map(mapCdrToCallRecord);
  })"""

new_src, n = re.subn(old_calls, new_calls, src, flags=re.DOTALL)
if n:
    src = new_src
    print(f'  ✅ calls() branché sur fusionpbx-proxy')
else:
    print('  ⚠️  Pattern calls() non trouvé')

# 3. voicemails() — remplace /mobile-voicemails
old_vm = r"voicemails:\s*\(\)\s*=>\s*call<VoicemailEntry\[\]>\('/mobile-voicemails'[^)]+\)"
new_vm = """voicemails: () => call<VoicemailEntry[]>(
    '/fusionpbx-proxy',
    { method: 'POST', body: JSON.stringify({ action: 'sync-cdrs', limit: 50 }) },
    voicemailMock
  ).then((raw: any) => {
    if (!Array.isArray(raw?.rows ?? raw)) return voicemailMock;
    return (raw?.rows ?? raw)
      .filter((r: any) => r.voicemail_message || r.missed_call)
      .map(mapCdrToVoicemailEntry);
  })"""

new_src, n = re.subn(old_vm, new_vm, src, flags=re.DOTALL)
if n:
    src = new_src
    print(f'  ✅ voicemails() branché sur fusionpbx-proxy')
else:
    print('  ⚠️  Pattern voicemails() non trouvé')

# 4. voicemailAudio — ajouter get-recording
old_audio = r"voicemailAudio:\s*\(id: string\)\s*=>\s*call<[^>]+>\([^)]+\)"
new_audio = """voicemailAudio: (id: string) => call<{ url: string; expiresInSec: number }>(
    `/fusionpbx-proxy?action=get-recording&id=${encodeURIComponent(id)}`,
    { method: 'POST', body: JSON.stringify({ action: 'get-recording', id }) },
    { url: '', expiresInSec: 0 }
  )"""

new_src, n = re.subn(old_audio, new_audio, src, flags=re.DOTALL)
if n:
    src = new_src
    print(f'  ✅ voicemailAudio() branché sur get-recording')
else:
    print('  ⚠️  Pattern voicemailAudio() non trouvé')

if src != original:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    print('  ✅ mobileApi.ts mis à jour')
else:
    print('  ⏭  Aucune modification nécessaire dans mobileApi.ts')
PYEOF

# ============================================================
# PATCH 3 — Trigger sync CDRs au démarrage (App.tsx desktop)
# ============================================================
APP_TSX="$REPO_ROOT/apps/ava-softphone-desktop/src/App.tsx"
echo ""
echo "--- Patch App.tsx (trigger CDR sync) ---"

if [ -f "$APP_TSX" ]; then
  python3 - "$APP_TSX" << 'PYEOF'
import sys, re

path = sys.argv[1]
with open(path, 'r', encoding='utf-8') as f:
    src = f.read()

if 'triggerCdrSync' in src:
    print('  ⏭  triggerCdrSync déjà présent')
    sys.exit(0)

sync_code = '''
// ── CDR sync au démarrage ──────────────────────────────────
const triggerCdrSync = async () => {
  try {
    const { supabase } = await import('./lib/supabaseClient');
    await supabase.functions.invoke('fusionpbx-proxy', {
      body: {
        action: 'sync-cdrs',
        organization_id: '71755d33-ed64-4ad5-a828-61c9d2029eb7',
        limit: 200,
      },
    });
    console.log('[AVA] CDR sync triggered');
  } catch (e) {
    console.warn('[AVA] CDR sync failed', e);
  }
};
triggerCdrSync();
const _cdrInterval = setInterval(triggerCdrSync, 5 * 60 * 1000);
// ────────────────────────────────────────────────────────────
'''

# Insérer avant le premier "export default"
new_src = re.sub(r'(export default\s)', sync_code + r'\1', src, count=1)
if new_src != src:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_src)
    print('  ✅ triggerCdrSync ajouté dans App.tsx')
else:
    print('  ⚠️  Insertion impossible — vérifier manuellement App.tsx')
PYEOF
else
  echo "  ⚠️  App.tsx non trouvé à $APP_TSX — skip"
fi

# ============================================================
# Résumé final
# ============================================================
echo ""
echo "============================================"
echo "✅ Patch appliqué avec succès !"
echo "============================================"
echo ""
echo "Prochaines étapes :"
echo "  1. cd ~/attach-app-creator"
echo "  2. git add -A"
echo "  3. git commit -m 'feat: live FusionPBX data — disable MOCK mode'"
echo "  4. git push origin main"
echo "  5. Rebuild desktop :"
echo "     cd apps/ava-softphone-desktop"
echo "     npx vite build && npx tsc -p electron/tsconfig.json && npx electron-builder --mac"
echo "     cp -R dist-electron/mac-arm64/'Lemtel Telecom.app' /Applications/"
echo "     open '/Applications/Lemtel Telecom.app'"
echo ""
echo "Fichiers sauvegardés :"
echo "  ${DESKTOP}.bak_${TS}"
echo "  ${MOBILE}.bak_${TS}"
