#!/usr/bin/env python3
"""
Lemtel CDR Display Fix — corrige les 3 problèmes:
1. History: "No recent calls" → affiche les vrais CDR
2. Voicemail: "?" → affiche caller_name/caller_number
3. Recordings: "Recording URL not playable yet" → signale correctement
"""
import os, re, shutil
from datetime import datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
TS   = datetime.now().strftime('%Y%m%d_%H%M%S')

def backup(path):
    shutil.copy2(path, path + f'.bak_cdrfix_{TS}')
    print(f'  📦 Backup: {os.path.basename(path)}')

def write(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  ✅ Written: {os.path.relpath(path, ROOT)}')

# ============================================================
# PATCH 1 — RecentsList.tsx  (History tab compact view)
# Vrais champs: caller_name, caller_number, destination, start_at,
#               duration_seconds, direction, call_status, missed_call
# ============================================================
RECENTS = os.path.join(ROOT, 'apps/ava-softphone-desktop/src/components/RecentsList.tsx')
if os.path.exists(RECENTS):
    backup(RECENTS)
    with open(RECENTS, 'r') as f:
        src = f.read()

    # Remplace la query Supabase directe par une query avec les bons champs
    old_query = re.search(
        r'\.from\(.pbx_call_records.\).*?setRows\([^;]+\);',
        src, re.DOTALL
    )
    if old_query:
        new_query = """.from('pbx_call_records')
        .select('id,caller_name,caller_number,destination,start_at,duration_seconds,billsec,direction,call_status,missed_call,has_recording,recording_path,recording_name,hangup_cause')
        .order('start_at', { ascending: false })
        .limit(50);
      if (err) { setLoading(false); return; }
      setRows((data || []) as any[]);"""
        src = src[:old_query.start()] + new_query + src[old_query.end():]

    # Fix le rendu — remplace les vieux champs par les nouveaux
    # caller_id_name → caller_name, caller_id_number → caller_number
    src = src.replace("r.caller_id_name", "r.caller_name")
    src = src.replace("r.caller_id_number", "r.caller_number")
    src = src.replace("r.caller_destination", "r.destination")
    src = src.replace("r.duration_sec", "r.duration_seconds || r.billsec || 0")
    src = src.replace("r.started_at", "r.start_at")
    src = src.replace("r.durationSec", "r.duration_seconds || r.billsec || 0")

    write(RECENTS, src)
else:
    print(f'  ⚠️  RecentsList.tsx not found')

# ============================================================
# PATCH 2 — VoicemailList.tsx  (Voicemail compact view)
# ============================================================
VMLIST = os.path.join(ROOT, 'apps/ava-softphone-desktop/src/components/VoicemailList.tsx')
if os.path.exists(VMLIST):
    backup(VMLIST)
    with open(VMLIST, 'r') as f:
        src = f.read()

    # Fix les noms de champs
    src = src.replace("r.caller_id_name", "r.caller_name")
    src = src.replace("r.caller_id_number", "r.caller_number")
    src = src.replace("r.recording_url", "r.recording_path ? `https://pbxnode.lemtel.tel/app/recordings/${r.recording_path}/${r.recording_name}` : null")
    src = src.replace("r.voicemail_message !== null", "(r.voicemail_message && r.voicemail_message !== 'false')")
    src = src.replace("r.voicemail_message", "(r.voicemail_message === 'false' ? null : r.voicemail_message)")
    src = src.replace("r.started_at", "r.start_at")
    src = src.replace("r.duration_seconds,", "(r.duration_seconds || r.billsec || 0),")

    # Fix la query pour inclure les bons champs
    src = src.replace(
        ".select('id,caller_name,caller_number,start_at,duration_seconds,recording_url,recording_path,voicemail_message')",
        ".select('id,caller_name,caller_number,start_at,duration_seconds,billsec,recording_path,recording_name,voicemail_message,missed_call,has_recording')"
    )

    write(VMLIST, src)
else:
    print(f'  ⚠️  VoicemailList.tsx not found')

# ============================================================
# PATCH 3 — RecordingsList.tsx  (Recordings compact view)
# ============================================================
RECLIST = os.path.join(ROOT, 'apps/ava-softphone-desktop/src/components/RecordingsList.tsx')
if os.path.exists(RECLIST):
    backup(RECLIST)
    with open(RECLIST, 'r') as f:
        src = f.read()

    # Fix les champs
    src = src.replace("r.caller_id_name", "r.caller_name")
    src = src.replace("r.caller_id_number", "r.caller_number")
    src = src.replace("r.started_at", "r.start_at")
    src = src.replace("r.duration_sec", "r.duration_seconds || r.billsec || 0")
    src = src.replace("r.recording_url", "(r.recording_path ? `https://pbxnode.lemtel.tel/${r.recording_path}/${r.recording_name}` : null)")

    # Fix le filtre has_recording
    src = src.replace(
        ".filter(r => r.has_recording || r.recording_url)",
        ".filter((r: any) => r.has_recording || r.recording_path)"
    )

    write(RECLIST, src)
else:
    print(f'  ⚠️  RecordingsList.tsx not found')

# ============================================================
# PATCH 4 — avaApi.ts (mappeurs CDR pour wide mode)
# ============================================================
AVAAPI = os.path.join(ROOT, 'apps/ava-softphone-desktop/src/lib/avaApi.ts')
if os.path.exists(AVAAPI):
    backup(AVAAPI)
    with open(AVAAPI, 'r') as f:
        src = f.read()

    # Fix mapCdrToCall — utilise les vrais champs Supabase
    new_mapper = '''
/* ─── Mappeurs CDR FusionPBX → UI (champs réels Supabase) ─── */
function mapCdrToCall(r: any): CallRecord {
  const billsec = Number(r.billsec ?? r.duration_seconds ?? 0);
  const missed  = r.missed_call === true || r.call_status === 'missed' ||
                  r.hangup_cause === 'NO_ANSWER' || (billsec === 0 && r.direction !== 'outbound');
  const isVm    = r.voicemail_message && r.voicemail_message !== 'false';
  return {
    id:           r.id ?? r.pbx_uuid ?? String(Math.random()),
    direction:    (r.direction === 'outbound' ? 'out' : 'in') as 'in' | 'out',
    status:       (isVm ? 'voicemail' : missed ? 'missed' : 'answered') as any,
    from:         r.caller_number ?? r.source_number ?? '',
    to:           r.destination ?? r.destination_number ?? '',
    customer:     r.caller_name && r.caller_name !== r.caller_number ? r.caller_name : undefined,
    startedAt:    r.start_at ?? new Date().toISOString(),
    durationSec:  billsec,
    hasRecording: !!(r.has_recording || r.recording_path || r.recording_name),
    hasTranscript: !!r.transcribed,
    sentiment:    undefined,
  };
}

function mapCdrToVoicemail(r: any): VoicemailItem {
  const vm = r.voicemail_message && r.voicemail_message !== 'false' ? r.voicemail_message : null;
  return {
    id:          r.id ?? String(Math.random()),
    from:        r.caller_number ?? r.source_number ?? '',
    customer:    r.caller_name && r.caller_name !== r.caller_number ? r.caller_name : undefined,
    receivedAt:  r.start_at ?? new Date().toISOString(),
    durationSec: Number(r.billsec ?? r.duration_seconds ?? 0),
    isNew:       !r.voicemail_read,
    transcript:  vm ?? 'Transcription non disponible.',
    summary:     vm ? vm.slice(0, 120) + (vm.length > 120 ? '…' : '') : 'Aucun résumé disponible.',
    sentiment:   'neutral' as const,
    priority:    'normal' as const,
    handled:     false,
    feedback:    null,
  };
}

function mapCdrToRecording(r: any): RecordingItem {
  const url = r.recording_path && r.recording_name
    ? `https://pbxnode.lemtel.tel/${r.recording_path}/${r.recording_name}`
    : null;
  return {
    id:          r.id ?? String(Math.random()),
    callId:      r.id ?? '',
    from:        r.caller_number ?? r.source_number ?? '',
    to:          r.destination ?? r.destination_number ?? '',
    customer:    r.caller_name && r.caller_name !== r.caller_number ? r.caller_name : undefined,
    recordedAt:  r.start_at ?? new Date().toISOString(),
    durationSec: Number(r.billsec ?? r.duration_seconds ?? 0),
    sizeKb:      0,
    qualityScore: Math.round((r.mos ?? 0) * 20),
    sentiment:   'neutral' as const,
    summary:     url ? 'Enregistrement disponible.' : 'Chemin enregistrement non disponible.',
    topics:      [],
    tags:        [],
    feedback:    null,
    recordingUrl: url,
  };
}

'''

    # Remplace les anciens mappeurs s'ils existent
    if 'mapCdrToCall' in src:
        src = re.sub(
            r'/\* ─── Mappeurs CDR.*?^(?=export const ava)',
            new_mapper,
            src, flags=re.DOTALL | re.MULTILINE
        )
    else:
        # Insère avant "export const ava"
        src = re.sub(r'(export const ava\s*=\s*\{)', new_mapper + r'\1', src)

    # Fix calls() — utilise la vraie table Supabase directement
    calls_replacement = '''calls: (limit = 100) => call<CallRecord[]>(
    \`/db/\${TABLES.callRecords}?select=id,caller_name,caller_number,destination,source_number,destination_number,start_at,duration_seconds,billsec,direction,call_status,missed_call,has_recording,recording_path,recording_name,hangup_cause,voicemail_message,transcribed,mos&order=start_at.desc&limit=\${limit}\`,
    {},
    MOCK_CALLS
  ).then((data: any) => {
    if (MOCK || !Array.isArray(data)) return data as CallRecord[];
    return data.map(mapCdrToCall);
  })'''

    src = re.sub(
        r'calls:\s*\(limit\s*=\s*\d+\)\s*=>.*?\.then\([^)]+\)\)',
        calls_replacement,
        src, flags=re.DOTALL
    )

    # Fix voicemails()
    vm_replacement = '''voicemails: (limit = 50) => call<VoicemailItem[]>(
    \`/db/\${TABLES.callRecords}?select=id,caller_name,caller_number,source_number,start_at,duration_seconds,billsec,voicemail_message,missed_call,has_recording,recording_path,recording_name&or=(voicemail_message.neq.false,missed_call.eq.true)&order=start_at.desc&limit=\${limit}\`,
    {},
    MOCK_VM
  ).then((data: any) => {
    if (MOCK || !Array.isArray(data)) return data as VoicemailItem[];
    return data
      .filter((r: any) => r.voicemail_message && r.voicemail_message !== 'false')
      .map(mapCdrToVoicemail);
  })'''

    src = re.sub(
        r'voicemails:\s*\([^)]*\)\s*=>.*?(?=,\s*\n\s*markVoicemailRead)',
        vm_replacement,
        src, flags=re.DOTALL
    )

    # Fix recordings()
    rec_replacement = '''recordings: (limit = 100) => call<RecordingItem[]>(
    \`/db/\${TABLES.callRecords}?select=id,caller_name,caller_number,source_number,destination_number,destination,start_at,duration_seconds,billsec,has_recording,recording_path,recording_name,mos,transcribed&has_recording=eq.true&order=start_at.desc&limit=\${limit}\`,
    {},
    MOCK_RECORDINGS
  ).then((data: any) => {
    if (MOCK || !Array.isArray(data)) return data as RecordingItem[];
    return data.filter((r: any) => r.has_recording || r.recording_path).map(mapCdrToRecording);
  })'''

    src = re.sub(
        r'recordings:\s*\([^)]*\)\s*=>.*?(?=,\s*\n\s*contacts)',
        rec_replacement,
        src, flags=re.DOTALL
    )

    write(AVAAPI, src)

# ============================================================
# PATCH 5 — CallsView.tsx (wide mode calls list)
# ============================================================
CALLSVIEW = os.path.join(ROOT, 'apps/ava-softphone-desktop/src/components/console/CallsView.tsx')
if os.path.exists(CALLSVIEW):
    backup(CALLSVIEW)
    with open(CALLSVIEW, 'r') as f:
        src = f.read()

    # Fix les champs affichés
    src = src.replace("cr.from", "(cr.from || '')")
    src = src.replace("cr.to", "(cr.to || '')")

    write(CALLSVIEW, src)

print('\n============================================')
print('✅ CDR Display Fix appliqué!')
print('============================================')
print('\nProchaines étapes:')
print('  cd ~/attach-app-creator/apps/ava-softphone-desktop')
print('  npx vite build && npx tsc -p electron/tsconfig.json && npx electron-builder --mac --arm64')
print('  sudo rm -rf "/Applications/Lemtel Telecom.app"')
print('  cp -R dist-electron/mac-arm64/"Lemtel Telecom.app" /Applications/')
print('  open "/Applications/Lemtel Telecom.app"')
