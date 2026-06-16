import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LibraryGreeting = {
  id: string;
  name: string;
  extension: string | null;
  source: string;
  text_script: string | null;
  voice_id: string | null;
  voice_name: string | null;
  storage_path: string;
  audio_url: string | null;
  is_active: boolean;
  status: "ready" | "generating" | "failed";
  error_message: string | null;
  attempts: number;
  last_attempt_at: string | null;
  created_at: string;
};

export type Extension = { extension: string; display_name: string | null };
export type Voice = { id: string; name: string };

async function call(action: string, payload?: any) {
  const { data, error } = await supabase.functions.invoke("user-voicemail-greeting", {
    body: { action, payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useGreetingsLibrary() {
  const qc = useQueryClient();
  const query = useQuery<{ greetings: LibraryGreeting[]; extensions: Extension[]; voices: Voice[] }>({
    queryKey: ["my-greetings-library"],
    queryFn: () => call("list_greetings"),
    refetchInterval: (q) =>
      (q.state.data?.greetings ?? []).some((g) => g.status === "generating") ? 3000 : false,
  });
  const inv = () => qc.invalidateQueries({ queryKey: ["my-greetings-library"] });
  return {
    query,
    create: useMutation({
      mutationFn: (p: { name: string; text: string; voice_id: string; extension: string | null }) =>
        call("create_greeting", p),
      onSuccess: inv,
    }),
    remove: useMutation({ mutationFn: (id: string) => call("delete_greeting", { id }), onSuccess: inv }),
    activate: useMutation({ mutationFn: (id: string) => call("activate_greeting", { id }), onSuccess: inv }),
    rename: useMutation({
      mutationFn: (p: { id: string; name: string }) => call("rename_greeting", p),
      onSuccess: inv,
    }),
  };
}
