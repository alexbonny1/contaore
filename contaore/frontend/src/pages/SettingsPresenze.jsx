import { useEffect, useState } from "react";
import { API_URL } from "../api";
import { Toast, Toggle, SettingsHeader } from "../components/SettingsUI";

export default function SettingsPresenze() {
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);
  const [tolleranza, setTolleranza] = useState(10);
  const [snapToShift, setSnapToShift] = useState(false);
  const [saving, setSaving]     = useState(false);

  const showToast = (message, type = "success") => setToast({ message, type });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const token = localStorage.getItem("token");
    try {
      const res  = await fetch(API_URL + "/api/company/settings", { headers: { Authorization: "Bearer " + token } });
      const data = await res.json();
      if (data.success) {
        setTolleranza(data.tolleranza_straordinario_minuti ?? 10);
        setSnapToShift(data.arrotonda_ore_al_turno ?? false);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/company/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ tolleranza_straordinario_minuti: tolleranza, arrotonda_ore_al_turno: snapToShift }),
      });
      const data = await res.json();
      if (data.success) showToast("Impostazioni salvate");
      else showToast("Errore nel salvataggio", "error");
    } catch (_) { showToast("Errore di connessione", "error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <SettingsHeader title="Presenze e turni" subtitle="Calcolo degli straordinari" />

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-8 text-center">
          <p className="text-sm text-zinc-400">Caricamento...</p>
        </div>
      ) : (
        <form onSubmit={save}>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-5">

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tolleranza straordinari</label>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Minuti di margine per lato (entrata + uscita) sotto cui non viene generato straordinario.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number" min={0} max={60} value={tolleranza}
                  onChange={e => setTolleranza(Number(e.target.value))}
                  className="w-24 h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[16px] sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
                />
                <span className="text-sm text-zinc-500">minuti</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[0, 5, 10, 15].map(v => (
                  <button key={v} type="button" onClick={() => setTolleranza(v)}
                    className={`h-8 px-3 rounded-xl text-xs font-medium transition-colors ${tolleranza === v ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}>
                    {v === 0 ? "Nessuna" : `${v} min`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Arrotonda ore al turno</p>
                <p className="text-xs text-zinc-400 leading-relaxed mt-0.5">Entro la tolleranza, il giorno conta come ore previste nel totale mensile</p>
              </div>
              <Toggle value={snapToShift} onChange={setSnapToShift} />
            </div>

            <button type="submit" disabled={saving}
              className="w-full h-11 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-50">
              {saving ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
