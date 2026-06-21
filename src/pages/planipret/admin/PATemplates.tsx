import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit3, Save, X } from "lucide-react";
import { toast } from "sonner";

type Tpl = { id: string; user_id: string | null; title: string; body: string; is_shared: boolean; use_count: number; created_at: string };

export default function PATemplates() {
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [creating, setCreating] = useState<{ title: string; body: string } | null>(null);

  const load = async () => {
    const { data } = await supabase.from("planipret_sms_templates").select("*").eq("is_shared", true).order("title");
    setTpls((data ?? []) as Tpl[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!creating) return;
    const { error } = await supabase.from("planipret_sms_templates").insert({
      title: creating.title, body: creating.body, is_shared: true, user_id: null,
    });
    if (error) return toast.error(error.message);
    toast.success("Template créé"); setCreating(null); load();
  };

  const update = async () => {
    if (!editing) return;
    const { error } = await supabase.from("planipret_sms_templates").update({ title: editing.title, body: editing.body }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Mis à jour"); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce template ?")) return;
    const { error } = await supabase.from("planipret_sms_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Templates SMS partagés</h1>
        <button onClick={() => setCreating({ title: "", body: "" })}
          className="px-3 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5 bg-blue-600">
          <Plus className="w-4 h-4" /> Nouveau
        </button>
      </header>

      {creating && (
        <div className="bg-white border rounded-lg p-4 mb-4 space-y-2">
          <input placeholder="Titre" value={creating.title} onChange={(e) => setCreating({ ...creating, title: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm" />
          <textarea placeholder="Corps du message (variables: {nom}, {date}, {heure}, {extension})" rows={3}
            value={creating.body} onChange={(e) => setCreating({ ...creating, body: e.target.value })}
            className="w-full px-3 py-2 border rounded text-sm" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreating(null)} className="px-3 py-1.5 text-sm border rounded">Annuler</button>
            <button onClick={save} className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded">Créer</button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg divide-y">
        {tpls.map((t) => (
          <div key={t.id} className="p-4">
            {editing?.id === t.id ? (
              <div className="space-y-2">
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full px-3 py-2 border rounded text-sm" />
                <textarea rows={3} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="w-full px-3 py-2 border rounded text-sm" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm border rounded flex items-center gap-1"><X className="w-3 h-3" /> Annuler</button>
                  <button onClick={update} className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded flex items-center gap-1"><Save className="w-3 h-3" /> Sauver</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800">{t.title}</div>
                  <div className="text-sm text-slate-600 mt-0.5">{t.body}</div>
                  <div className="text-xs text-slate-400 mt-1">Utilisations: {t.use_count}</div>
                </div>
                <button onClick={() => setEditing(t)} className="p-1.5 text-slate-500 hover:text-blue-600"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => remove(t.id)} className="p-1.5 text-slate-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        ))}
        {tpls.length === 0 && !creating && <div className="p-6 text-center text-slate-400">Aucun template partagé.</div>}
      </div>
    </div>
  );
}
