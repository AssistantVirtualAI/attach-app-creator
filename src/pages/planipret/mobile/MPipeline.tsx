import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Phone } from "lucide-react";
import type { PlanipretMobileContext } from "../PlanipretMobile";

type Card = {
  id: string;
  contact_name: string;
  contact_number: string | null;
  stage: string;
  maestro_contact_id: string | null;
  notes: string | null;
  last_call_id: string | null;
  updated_at: string;
};

const STAGES: Array<{ key: string; label: string; emoji: string }> = [
  { key: "new", label: "Nouveau", emoji: "🆕" },
  { key: "qualified", label: "Qualifié", emoji: "✅" },
  { key: "analyzing", label: "En analyse", emoji: "🔍" },
  { key: "submitted", label: "Soumis", emoji: "📋" },
  { key: "approved", label: "Approuvé", emoji: "🎉" },
  { key: "closed", label: "Fermé", emoji: "🔒" },
];

const PRIMARY = "var(--pp-brand-accent-2)";

export default function MPipeline() {
  const { profile, openDialer } = useOutletContext<PlanipretMobileContext>();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Card | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = async () => {
    if (!profile?.user_id) return;
    setLoading(true);
    const { data } = await supabase.from("planipret_pipeline").select("*").eq("user_id", profile.user_id).order("updated_at", { ascending: false });
    setCards((data ?? []) as Card[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile?.user_id]);

  const moveStage = async (id: string, stage: string) => {
    const prev = cards;
    setCards((cs) => cs.map((c) => c.id === id ? { ...c, stage } : c));
    const { error } = await supabase.from("planipret_pipeline").update({ stage }).eq("id", id);
    if (error) { setCards(prev); toast.error("Erreur"); return; }
    toast.success("Étape mise à jour");
    // Best-effort Maestro sync
    const card = cards.find((c) => c.id === id);
    if (card?.maestro_contact_id) {
      supabase.functions.invoke("maestro-actions", { body: { action: "update_contact_stage", payload: { contact_id: card.maestro_contact_id, stage } } }).catch(() => {});
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "#F4F6F9" }}>
      <div className="px-4 pt-5 pb-3 bg-white border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--pp-text-primary)" }}>📊 Pipeline</h1>
          <p className="text-xs text-slate-500">{cards.length} dossier{cards.length > 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="w-9 h-9 rounded-full text-white flex items-center justify-center" style={{ background: PRIMARY }}>
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Chargement…</div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-3 p-3 h-full" style={{ width: "max-content" }}>
            {STAGES.map((s) => {
              const items = cards.filter((c) => c.stage === s.key);
              return (
                <div key={s.key} className="w-[260px] flex flex-col bg-white rounded-2xl shadow-sm">
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: "var(--pp-text-primary)" }}>{s.emoji} {s.label}</span>
                    <span className="text-[11px] text-slate-400 tabular-nums">{items.length}</span>
                  </div>
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                    {items.length === 0 ? (
                      <p className="text-[11px] text-slate-300 text-center py-4">Aucun dossier</p>
                    ) : items.map((c) => (
                      <button key={c.id} onClick={() => setSelected(c)}
                        className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-lg p-2.5">
                        <div className="text-sm font-semibold truncate" style={{ color: "var(--pp-text-primary)" }}>{c.contact_name}</div>
                        {c.contact_number && <div className="text-[11px] text-slate-500 truncate">{c.contact_number}</div>}
                        <div className="flex items-center justify-end mt-1">
                          <span onClick={(e) => { e.stopPropagation(); openDialer(c.contact_number ?? undefined); }}
                            className="text-[11px] font-semibold px-2 py-1 rounded-md text-white" style={{ background: PRIMARY }}>📞</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <DetailSheet card={selected} onClose={() => setSelected(null)} onMove={moveStage} onChanged={load} />
      )}
      {addOpen && (
        <AddSheet userId={profile.user_id} onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); load(); }} />
      )}
    </div>
  );
}

function DetailSheet({ card, onClose, onMove, onChanged }: { card: Card; onClose: () => void; onMove: (id: string, stage: string) => void; onChanged: () => void }) {
  const [notes, setNotes] = useState(card.notes ?? "");
  const [busy, setBusy] = useState(false);

  const saveNotes = async () => {
    setBusy(true);
    await supabase.from("planipret_pipeline").update({ notes }).eq("id", card.id);
    setBusy(false);
    toast.success("Notes enregistrées");
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={{ color: "var(--pp-text-primary)" }}>{card.contact_name}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        {card.contact_number && (
          <p className="text-sm text-slate-500 mb-3">{card.contact_number}</p>
        )}

        <label className="block text-xs text-slate-500 mb-1">Étape</label>
        <select value={card.stage} onChange={(e) => onMove(card.id, e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm mb-3">
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}
        </select>

        <label className="block text-xs text-slate-500 mb-1">Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm mb-3" />

        <div className="flex gap-2">
          <button onClick={saveNotes} disabled={busy} className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold" style={{ background: PRIMARY }}>
            {busy ? "…" : "Enregistrer"}
          </button>
          {!card.maestro_contact_id && (
            <button onClick={async () => {
              const { data } = await supabase.functions.invoke("maestro-actions", { body: { action: "create_contact", payload: { name: card.contact_name, phone: card.contact_number } } });
              const mid = (data as any)?.contact_id ?? (data as any)?.id;
              if (mid) {
                await supabase.from("planipret_pipeline").update({ maestro_contact_id: mid }).eq("id", card.id);
                toast.success("Créé dans Maestro");
                onChanged();
              } else toast.error("Échec Maestro");
            }} className="px-3 py-2.5 rounded-lg text-sm border border-slate-200 text-slate-700">
              Créer dans Maestro
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddSheet({ userId, onClose, onAdded }: { userId: string; onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [stage, setStage] = useState("new");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) { toast.error("Nom requis"); return; }
    setBusy(true);
    const { error } = await supabase.from("planipret_pipeline").insert({ user_id: userId, contact_name: name, contact_number: number || null, stage });
    setBusy(false);
    if (error) { toast.error("Erreur"); return; }
    toast.success("Dossier ajouté");
    onAdded();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={{ color: "var(--pp-text-primary)" }}>Nouveau dossier</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <label className="block text-xs text-slate-500 mb-1">Nom du contact</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm mb-3" />
        <label className="block text-xs text-slate-500 mb-1">Numéro</label>
        <input value={number} onChange={(e) => setNumber(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm mb-3" />
        <label className="block text-xs text-slate-500 mb-1">Étape initiale</label>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm mb-3">
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}
        </select>
        <button onClick={save} disabled={busy} className="w-full py-2.5 rounded-lg text-white text-sm font-semibold" style={{ background: PRIMARY }}>
          {busy ? "…" : "Ajouter"}
        </button>
      </div>
    </div>
  );
}
