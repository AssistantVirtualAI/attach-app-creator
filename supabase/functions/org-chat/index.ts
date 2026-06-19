// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "missing_auth" }, 401);

    const URL_ = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "invalid_auth" }, 401);
    const userId = u.user.id;
    const admin = createClient(URL_, SERVICE);

    const { action, payload } = await req.json().catch(() => ({}));
    if (!action) return json({ error: "missing_action" }, 400);

    // org of caller (single workspace; support admin, portal and softphone users)
    const { data: m } = await admin.from("organization_members").select("organization_id").eq("user_id", userId).limit(1).maybeSingle();
    const { data: m2 } = m?.organization_id ? { data: null } : await admin.from("org_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
    const { data: sp } = (m?.organization_id || m2?.org_id) ? { data: null } : await admin.from("pbx_softphone_users").select("organization_id").eq("portal_user_id", userId).limit(1).maybeSingle();
    const { data: role } = (m?.organization_id || m2?.org_id || sp?.organization_id) ? { data: null } : await admin.from("user_roles").select("organization_id").eq("user_id", userId).limit(1).maybeSingle();
    const orgId: string | null = m?.organization_id ?? m2?.org_id ?? sp?.organization_id ?? role?.organization_id ?? null;
    if (!orgId) return json({ error: "no_org" }, 400);

    // profile (sender_name)
    const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
    const senderName = prof?.full_name || prof?.email || "User";

    async function isMember(channelId: string): Promise<{ ok: boolean; channel?: any }> {
      const { data: ch } = await admin.from("org_chat_channels").select("*").eq("id", channelId).maybeSingle();
      if (!ch || ch.organization_id !== orgId) return { ok: false };
      if (ch.channel_type === "public") return { ok: true, channel: ch };
      const members: string[] = ch.members ?? [];
      return { ok: members.includes(userId), channel: ch };
    }

    if (action === "list_channels") {
      await admin.rpc("ensure_general_channel", { _org_id: orgId, _user_id: userId });
      const { data, error } = await admin
        .from("org_chat_channels")
        .select("*")
        .eq("organization_id", orgId)
        .or(`channel_type.eq.public,members.cs.{${userId}}`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ channels: data ?? [] });
    }

    if (action === "create_channel") {
      const name = String(payload?.name ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 50);
      if (!name) return json({ error: "invalid_name" }, 400);
      const type = payload?.channel_type === "private" ? "private" : "public";
      const members: string[] = Array.from(new Set([userId, ...(payload?.members ?? [])]));
      const { data, error } = await admin
        .from("org_chat_channels")
        .insert({
          organization_id: orgId,
          name,
          description: payload?.description ?? null,
          channel_type: type,
          created_by: userId,
          members,
        })
        .select()
        .single();
      if (error) throw error;
      return json({ channel: data });
    }

    if (action === "list_messages") {
      const channelId = payload?.channel_id;
      if (!channelId) return json({ error: "missing_channel" }, 400);
      const access = await isMember(channelId);
      if (!access.ok) return json({ error: "forbidden" }, 403);
      const limit = Math.min(payload?.limit ?? 50, 100);
      let q = admin.from("org_chat_messages").select("*").eq("channel_id", channelId).order("created_at", { ascending: false }).limit(limit);
      if (payload?.before) q = q.lt("created_at", payload.before);
      const { data, error } = await q;
      if (error) throw error;
      return json({ messages: (data ?? []).reverse() });
    }

    if (action === "send_message") {
      const channelId = payload?.channel_id;
      const content = String(payload?.content ?? "").trim();
      const attachments = payload?.attachments ?? [];
      const parentId = payload?.parent_message_id ?? null;
      if (!channelId || (!content && attachments.length === 0)) return json({ error: "empty" }, 400);
      const access = await isMember(channelId);
      if (!access.ok) return json({ error: "forbidden" }, 403);
      if (parentId) {
        const { data: parent } = await admin.from("org_chat_messages").select("channel_id").eq("id", parentId).maybeSingle();
        if (!parent || parent.channel_id !== channelId) return json({ error: "invalid_parent" }, 400);
      }
      const { data, error } = await admin
        .from("org_chat_messages")
        .insert({
          organization_id: orgId,
          channel_id: channelId,
          sender_id: userId,
          sender_name: senderName,
          content,
          attachments,
          message_type: "text",
          reactions: {},
          read_by: [userId],
          parent_message_id: parentId,
        })
        .select()
        .single();
      if (error) throw error;
      return json({ message: data });
    }

    if (action === "list_thread") {
      const parentId = payload?.parent_message_id;
      if (!parentId) return json({ error: "missing_parent" }, 400);
      const { data: parent } = await admin.from("org_chat_messages").select("channel_id").eq("id", parentId).maybeSingle();
      if (!parent) return json({ error: "not_found" }, 404);
      const access = await isMember(parent.channel_id);
      if (!access.ok) return json({ error: "forbidden" }, 403);
      const { data, error } = await admin
        .from("org_chat_messages")
        .select("*")
        .eq("parent_message_id", parentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ messages: data ?? [] });
    }

    if (action === "search_messages") {
      const q = String(payload?.query ?? "").trim();
      if (!q) return json({ messages: [] });
      const limit = Math.min(payload?.limit ?? 30, 100);
      const { data: channels } = await admin
        .from("org_chat_channels")
        .select("id, name, channel_type, members")
        .eq("organization_id", orgId);
      const accessible = (channels ?? [])
        .filter((c: any) => c.channel_type === "public" || (c.members ?? []).includes(userId))
        .map((c: any) => c.id);
      if (accessible.length === 0) return json({ messages: [] });
      const ids = payload?.channel_id ? [payload.channel_id].filter((id: string) => accessible.includes(id)) : accessible;
      if (ids.length === 0) return json({ messages: [] });
      const { data, error } = await admin
        .from("org_chat_messages")
        .select("*")
        .in("channel_id", ids)
        .textSearch("tsv", q, { type: "websearch", config: "french" })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json({ messages: data ?? [] });
    }

    if (action === "edit_message") {
      const { data: msg } = await admin.from("org_chat_messages").select("*").eq("id", payload.id).maybeSingle();
      if (!msg || msg.sender_id !== userId) return json({ error: "forbidden" }, 403);
      const { error } = await admin.from("org_chat_messages").update({ content: payload.content, edited_at: new Date().toISOString() }).eq("id", payload.id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete_message") {
      const { data: msg } = await admin.from("org_chat_messages").select("*").eq("id", payload.id).maybeSingle();
      if (!msg || msg.sender_id !== userId) return json({ error: "forbidden" }, 403);
      await admin.from("org_chat_messages").update({ content: "", message_type: "deleted", attachments: [] }).eq("id", payload.id);
      return json({ ok: true });
    }

    if (action === "toggle_reaction") {
      const { data: msg } = await admin.from("org_chat_messages").select("reactions, channel_id").eq("id", payload.id).maybeSingle();
      if (!msg) return json({ error: "not_found" }, 404);
      const access = await isMember(msg.channel_id);
      if (!access.ok) return json({ error: "forbidden" }, 403);
      const r = (msg.reactions ?? {}) as Record<string, string[]>;
      const emoji = String(payload.emoji ?? "👍");
      const users = new Set(r[emoji] ?? []);
      if (users.has(userId)) users.delete(userId); else users.add(userId);
      r[emoji] = Array.from(users);
      if (r[emoji].length === 0) delete r[emoji];
      await admin.from("org_chat_messages").update({ reactions: r }).eq("id", payload.id);
      return json({ ok: true, reactions: r });
    }

    if (action === "mark_read") {
      const channelId = payload?.channel_id;
      const access = await isMember(channelId);
      if (!access.ok) return json({ error: "forbidden" }, 403);
      // append userId to read_by for last 100 unread messages of the channel
      await admin.rpc("noop").catch(() => {}); // avoid heavy SQL; client just tracks last_read locally
      return json({ ok: true });
    }

    if (action === "upload_url") {
      const filename = String(payload?.filename ?? "file").replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `${orgId}/${userId}/${Date.now()}-${filename}`;
      const { data, error } = await admin.storage.from("chat-attachments").createSignedUploadUrl(path);
      if (error) throw error;
      return json({ path, token: data.token, signedUrl: data.signedUrl });
    }

    if (action === "signed_url") {
      const path = String(payload?.path);
      const { data, error } = await admin.storage.from("chat-attachments").createSignedUrl(path, 3600);
      if (error) throw error;
      return json({ url: data.signedUrl });
    }

    if (action === "list_directory") {
      // Collect every user belonging to the same org (organization_members + org_members)
      const [{ data: m1 }, { data: m2 }] = await Promise.all([
        admin.from("organization_members").select("user_id").eq("organization_id", orgId),
        admin.from("org_members").select("user_id").eq("org_id", orgId),
      ]);
      const ids = Array.from(new Set([
        ...(m1 ?? []).map((r: any) => r.user_id),
        ...(m2 ?? []).map((r: any) => r.user_id),
      ])).filter(Boolean);
      if (ids.length === 0) return json({ members: [] });
      const [{ data: profs }, { data: pres }, { data: spu }] = await Promise.all([
        admin.from("profiles").select("id, full_name, email, avatar_url").in("id", ids),
        admin.from("user_presence").select("user_id, status, status_message, call_state, last_seen_at").in("user_id", ids),
        admin.from("pbx_softphone_users").select("portal_user_id, extension").in("portal_user_id", ids),
      ]);
      const presenceMap = new Map((pres ?? []).map((p: any) => [p.user_id, p]));
      const extMap = new Map((spu ?? []).map((s: any) => [s.portal_user_id, s.extension]));
      const members = (profs ?? []).map((p: any) => {
        const pr = presenceMap.get(p.id) as any;
        const lastSeen = pr?.last_seen_at ? new Date(pr.last_seen_at).getTime() : 0;
        const stale = !lastSeen || Date.now() - lastSeen > 5 * 60 * 1000;
        let status = pr?.status || "offline";
        if (stale && status !== "offline") status = "away";
        if (pr?.call_state && pr.call_state !== "idle") status = "on_call";
        return {
          user_id: p.id,
          full_name: p.full_name,
          email: p.email,
          avatar_url: p.avatar_url,
          extension: extMap.get(p.id) ?? null,
          status,
          status_message: pr?.status_message ?? null,
          is_self: p.id === userId,
        };
      }).sort((a: any, b: any) => (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""));
      return json({ members });
    }

    if (action === "ensure_dm_channel") {
      const otherId = String(payload?.user_id ?? "");
      if (!otherId || otherId === userId) return json({ error: "invalid_user" }, 400);
      // Verify other user belongs to the same org
      const { data: other } = await admin.from("organization_members").select("user_id").eq("organization_id", orgId).eq("user_id", otherId).maybeSingle();
      const { data: other2 } = await admin.from("org_members").select("user_id").eq("org_id", orgId).eq("user_id", otherId).maybeSingle();
      const { data: other3 } = (!other && !other2)
        ? await admin.from("pbx_softphone_users").select("portal_user_id").eq("organization_id", orgId).eq("portal_user_id", otherId).maybeSingle()
        : { data: null };
      if (!other && !other2 && !other3) return json({ error: "not_in_org" }, 403);
      const pair = [userId, otherId].sort();
      const dmKey = `dm:${pair[0].slice(0, 8)}:${pair[1].slice(0, 8)}`;
      const { data: existing } = await admin
        .from("org_chat_channels")
        .select("*")
        .eq("organization_id", orgId)
        .eq("name", dmKey)
        .maybeSingle();
      if (existing) return json({ channel: existing });
      const { data: created, error } = await admin
        .from("org_chat_channels")
        .insert({
          organization_id: orgId,
          name: dmKey,
          description: "Direct message",
          channel_type: "dm",
          created_by: userId,
          members: pair,
        })
        .select()
        .single();
      if (error) throw error;
      return json({ channel: created });
    }

    if (action === "heartbeat") {
      const status = String(payload?.status ?? "available");
      await admin.from("user_presence").upsert({
        user_id: userId,
        organization_id: orgId,
        status,
        status_message: payload?.message ?? null,
        status_emoji: payload?.emoji ?? null,
        call_state: payload?.call_state ?? "idle",
        platform: payload?.platform ?? "web",
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      return json({ ok: true });
    }

    if (action === "create_group") {
      const name = String(payload?.name ?? "").trim() || "group";
      const memberIds: string[] = Array.isArray(payload?.member_ids) ? payload.member_ids : [];
      const { data, error } = await admin.rpc("create_group_chat", { _name: name, _member_ids: memberIds });
      if (error) throw error;
      return json({ channel: data });
    }

    if (action === "mark_read") {
      const channelId = payload?.channel_id;
      if (!channelId) return json({ error: "missing_channel" }, 400);
      await admin.from("org_chat_reads").upsert({
        user_id: userId, channel_id: channelId, last_read_at: new Date().toISOString(),
      }, { onConflict: "user_id,channel_id" });
      return json({ ok: true });
    }

    if (action === "unread_counts") {
      const { data, error } = await admin.rpc("get_unread_counts");
      if (error) throw error;
      return json({ counts: data ?? [] });
    }

    if (action === "list_pins") {
      const channelId = payload?.channel_id;
      if (!channelId) return json({ error: "missing_channel" }, 400);
      const access = await isMember(channelId);
      if (!access.ok) return json({ error: "forbidden" }, 403);
      const { data: pins } = await admin.from("org_chat_message_pins")
        .select("message_id, pinned_by, pinned_at").eq("channel_id", channelId).order("pinned_at", { ascending: false });
      const ids = (pins ?? []).map((p: any) => p.message_id);
      if (ids.length === 0) return json({ pins: [], messages: [] });
      const { data: msgs } = await admin.from("org_chat_messages").select("*").in("id", ids);
      return json({ pins: pins ?? [], messages: msgs ?? [] });
    }

    if (action === "pin_message") {
      const { error } = await admin.rpc("pin_chat_message", { _message_id: payload?.id });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "unpin_message") {
      const { error } = await admin.rpc("unpin_chat_message", { _message_id: payload?.id });
      if (error) throw error;
      return json({ ok: true });
    }

    // ============ RECEIPTS ============
    if (action === "mark_messages_read") {
      const channelId = payload?.channel_id;
      if (!channelId) return json({ error: "missing_channel" }, 400);
      const { data, error } = await admin.rpc("mark_messages_read", { _channel_id: channelId, _up_to: payload?.up_to ?? new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true, inserted: data ?? 0 });
    }
    if (action === "get_receipts") {
      const { data, error } = await admin.rpc("get_message_receipts", { _message_id: payload?.message_id });
      if (error) throw error;
      return json({ receipts: data ?? [] });
    }

    // ============ EDIT HISTORY ============
    if (action === "get_edit_history") {
      const { data, error } = await admin.rpc("get_message_edit_history", { _message_id: payload?.message_id });
      if (error) throw error;
      return json({ history: data ?? [] });
    }

    // ============ SEARCH ============
    if (action === "search_all") {
      const q = String(payload?.query ?? "").trim();
      if (!q) return json({ messages: [], users: [] });
      const [{ data: msgs, error: e1 }, { data: users, error: e2 }] = await Promise.all([
        admin.rpc("search_chat", { _q: q, _limit: payload?.limit ?? 30 }),
        admin.rpc("search_chat_users", { _q: q, _limit: 15 }),
      ]);
      if (e1) throw e1; if (e2) throw e2;
      return json({ messages: msgs ?? [], users: users ?? [] });
    }

    // ============ MODERATION ============
    if (action === "list_blocks") {
      const { data } = await admin.from("org_chat_blocks").select("blocked_user_id, created_at").eq("blocker_id", userId);
      return json({ blocks: data ?? [] });
    }
    if (action === "block_user") {
      const other = String(payload?.user_id ?? "");
      if (!other || other === userId) return json({ error: "invalid_user" }, 400);
      const { error } = await admin.from("org_chat_blocks").upsert({ blocker_id: userId, blocked_user_id: other });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "unblock_user") {
      const other = String(payload?.user_id ?? "");
      await admin.from("org_chat_blocks").delete().eq("blocker_id", userId).eq("blocked_user_id", other);
      return json({ ok: true });
    }
    if (action === "report_message") {
      const messageId = String(payload?.message_id ?? "");
      const reason = String(payload?.reason ?? "").slice(0, 500);
      if (!messageId || !reason) return json({ error: "invalid" }, 400);
      const { data: msg } = await admin.from("org_chat_messages").select("channel_id, organization_id").eq("id", messageId).maybeSingle();
      if (!msg) return json({ error: "not_found" }, 404);
      const access = await isMember(msg.channel_id);
      if (!access.ok) return json({ error: "forbidden" }, 403);
      const { error } = await admin.from("org_chat_reports").insert({
        organization_id: msg.organization_id, channel_id: msg.channel_id,
        message_id: messageId, reporter_id: userId, reason, status: "open",
      });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "list_reports") {
      const { data, error } = await admin.from("org_chat_reports")
        .select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return json({ reports: data ?? [] });
    }
    if (action === "resolve_report") {
      const id = String(payload?.id ?? "");
      const resolution = String(payload?.resolution ?? "dismissed");
      const { data: rep } = await admin.from("org_chat_reports").select("organization_id").eq("id", id).maybeSingle();
      if (!rep) return json({ error: "not_found" }, 404);
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("organization_id", rep.organization_id);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "org_admin" || r.role === "super_admin");
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      await admin.from("org_chat_reports").update({
        status: "closed", reviewed_by: userId, reviewed_at: new Date().toISOString(), resolution,
      }).eq("id", id);
      return json({ ok: true });
    }
    if (action === "hide_message") {
      const { error } = await admin.rpc("hide_chat_message", { _message_id: payload?.message_id, _reason: payload?.reason ?? "Hidden by moderator" });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "unhide_message") {
      const { error } = await admin.rpc("unhide_chat_message", { _message_id: payload?.message_id });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
