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

    // org of caller (first membership)
    const { data: m } = await admin.from("organization_members").select("organization_id").eq("user_id", userId).limit(1).maybeSingle();
    const orgId: string | null = m?.organization_id ?? null;
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
      if (!channelId || (!content && attachments.length === 0)) return json({ error: "empty" }, 400);
      const access = await isMember(channelId);
      if (!access.ok) return json({ error: "forbidden" }, 403);
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
        })
        .select()
        .single();
      if (error) throw error;
      return json({ message: data });
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

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
