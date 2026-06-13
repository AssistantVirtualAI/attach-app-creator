## Lemtel Mascot — AI Agent Assistant

A persistent 3D mascot chatbot anchored to every page in the Lemtel org admin. It understands the platform, asks clarifying questions, and executes real writes (create users, customers, IVRs, queues, voice agents, reports…) step-by-step with confirmation.

---

### 1. Mascot character

A small **friendly cyber-fox** — round head, big glowing cyan eyes, two antenna-ears, soft glass-morphism body matching the AVA Statistic primary `#0023e6`. Generated as a `.glb` (rigged with morph targets for `mouthOpen`, `mouthSmile`, `blink`, `eyeLookL/R`).

Three states:
- **Idle** — slow breathing, occasional blink, ear twitch
- **Listening** — head tilts toward user, eyes pulse
- **Talking** — lipsync via morph-target driven by streamed-token cadence (token arrival → mouthOpen amplitude). No audio needed for text-only.

### 2. Placement & UX

```text
┌──────────────────────────────────────┐
│  page content                        │
│                                      │
│                                      │
│                          ┌────────┐  │
│                          │  3D    │  │  ← floating launcher (bottom-right)
│                          │ Mascot │  │     128×128, always visible
│                          └────────┘  │
└──────────────────────────────────────┘
```

- Floating launcher bottom-right of every authenticated page (NOT inside softphone window — uses its own portal layer at z-index above sidebar, below softphone overlay).
- Click → expands to a 420×640 glass-morphism chat panel (slides up + scales).
- Minimize button → collapses back to the bouncing mascot.
- Drag handle on header so user can reposition.
- Hidden on `/auth`, `/landing`, `/portal/*` (client portal), and inside softphone apps.

### 3. Capabilities — what the mascot can do

Tool-calling agent. Every tool maps to existing edge functions / RPCs. The agent **always** previews the action and asks "Confirm?" before mutation.

| Domain | Tools (sample) |
|---|---|
| Org & users | `create_sub_org`, `invite_member`, `assign_role`, `list_members`, `deactivate_user` |
| Customers/clients | `create_client`, `update_client`, `assign_agent_to_client`, `list_clients` |
| Voice agents | `create_voice_agent` (ElevenLabs/Vapi/Retell), `update_prompt`, `bind_agent_to_phone`, `test_agent` |
| Telephony / PBX | `list_extensions`, `create_extension`, `create_ivr`, `add_ivr_option`, `create_queue`, `add_queue_agent`, `create_ring_group`, `list_gateways`, `create_gateway`, `assign_did` |
| Reports / analytics | `get_call_stats`, `get_agent_health`, `get_lead_funnel`, `export_csv`, `schedule_report` |
| Knowledge base | `add_kb_article`, `search_kb`, `delete_kb_article` |
| Webhooks / API keys | `list_endpoints`, `create_endpoint`, `rotate_api_key` |
| Navigation | `goto_page(route)` — drives `useNavigate` so the bot can take the user to the result |

All tools route through one new edge function `mascot-agent` (server-side AI SDK with `stepCountIs(50)`), which dispatches to the existing edge functions (`fusionpbx-proxy`, `elevenlabs-phone-numbers`, `create-platform-agent`, etc.) and Supabase RPCs. No new business logic — the mascot is a thin orchestrator over what already exists.

### 4. Conversation behavior

System prompt encodes:
- Identity: "Lemtel, the AVA Statistic mascot"
- Business model: multi-tenant reseller, org → clients → voice agents → DIDs
- Current page context (route, org id, selected client if any) — injected per turn
- User role + permissions (gated server-side too)
- **Mandatory protocol**: gather → propose → confirm → execute → report.
  - Asks one question at a time when info is missing
  - Always shows a structured preview ("I'll create extension 105 for John Doe in domain quebec.lemtel.tel — confirm? [Yes/No]")
  - Mutations require explicit "yes/confirm/oui" before tool execution
- Bilingual: detects French/English and matches

### 5. Persistence

- Threaded conversations per user, stored in new `mascot_threads` + `mascot_messages` tables (RLS scoped to `auth.uid()`).
- Thread switcher in panel header. New-thread button. Last 30 days retained.

### 6. Technical

```text
src/components/mascot/
  MascotLauncher.tsx        ← floating 3D button + state
  MascotPanel.tsx           ← chat panel (AI Elements: Conversation, Message, PromptInput, Tool)
  MascotProvider.tsx        ← global mount + page-context provider
  three/
    FoxModel.tsx            ← R3F Canvas + GLTF loader
    useLipsync.ts           ← drives morph targets from streaming tokens
  hooks/useMascotChat.ts    ← useChat() → /functions/v1/mascot-agent
public/mascot/
  lemtel-fox.glb            ← generated, ~400KB

supabase/functions/mascot-agent/index.ts
  - AI SDK streamText with Lovable Gateway (google/gemini-3-flash-preview)
  - 25+ zod-typed tools, each calling existing edge fns / RPCs
  - needsApproval=true on every mutating tool
  - stepCountIs(50)

migration: mascot_threads, mascot_messages tables + RLS
```

Dependencies to add: `@react-three/fiber@^8.18`, `@react-three/drei@^9.122`, `three`, `ai`, `@ai-sdk/react`, AI Elements components.

### 7. Out of scope (phase 2)

- Voice output (TTS) — flagged off; can be enabled later by flipping a setting
- Embedding mascot into client portal or softphone apps
- Cross-org actions (mascot is scoped to current org context only)

### 8. Build order

1. Migration (threads/messages) + edge function skeleton with 5 read-only tools (list members/clients/extensions/queues/gateways)
2. `MascotProvider` + floating launcher with placeholder 2D avatar (verify positioning, hide rules)
3. Generate fox GLB asset, wire R3F + idle/talking states
4. Lipsync hook tied to streaming tokens
5. Add write tools in waves: org/users → customers → telephony → voice agents → reports
6. Confirmation UI (tool-result card with Yes/No buttons in chat)
7. Thread switcher + persistence
8. French/English polish + page-context injection
