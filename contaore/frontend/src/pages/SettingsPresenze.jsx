import { useEffect, useState } from "react";
import { API_URL } from "../api";
import { Toast, SettingsHeader } from "../components/SettingsUI";

function fmtMinuti(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h e ${m} minuti`;
  if (h > 0) return `${h} ${h === 1 ? "ora" : "ore"}`;
  return `${m} minuti`;
}

function ExampleCard({ label, color, lines }) {
  return (
    <div className={`rounded-2xl border p-4 space-y-1.5 ${color}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-60">{label}</p>
      {lines.map((l, i) => (
        <p key={i} className="text-xs leading-relaxed">{l}</p>
      ))}
    </div>
  );
}

export default function SettingsPresenze() {
  const [loading, setLoading]               = useState(true);
  const [toast, setToast]                   = useState(null);
  const [tolleranzaEccesso, setTolleranzaEccesso] = useState(20);
  const [tolleranzaDifetto, setTolleranzaDifetto] = useState(15);
  const [saving, setSaving]                 = useState(false);

  const showToast = (message, type = "success") => setToast({ message, type });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const token = localStorage.getItem("token");
    try {
      const res  = await fetch(API_URL + "/api/company/settings", { headers: { Authorization: "Bearer " + token } });
      const data = await res.json();
      if (data.success) {
        setTolleranzaEccesso(data.tolleranza_straordinario_minuti ?? 20);
        setTolleranzaDifetto(data.tolleranza_difetto_minuti ?? 15);
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
        body: JSON.stringify({
          tolleranza_straordinario_minuti: tolleranzaEccesso,
          tolleranza_difetto_minuti: tolleranzaDifetto,
        }),
      });
      const data = await res.json();
      if (data.success) showToast("Impostazioni salvate");
      else showToast("Errore nel salvataggio", "error");
    } catch (_) { showToast("Errore di connessione", "error"); }
    finally { setSaving(false); }
  }

  const eccesso = Number(tolleranzaEccesso) || 0;
  const difetto = Number(tolleranzaDifetto) || 0;

  const exEccessoOk   = `Il dipendente deve lavorare 8 ore. Lavora 8 ore e ${fmtMinuti(eccesso)}. Risulteranno comunque 8 ore.`;
  const exEccessoNo   = `Il dipendente deve lavorare 8 ore. Lavora 8 ore e ${fmtMinuti(eccesso + 1)}. Risulteranno 8 ore e ${fmtMinuti(eccesso + 1)}.`;
  const exDifettoOk   = `Il dipendente deve lavorare 8 ore. Lavora ${difetto >= 60 ? `${7 - Math.floor(difetto/60)} ore` : `7 ore e ${60 - difetto} minuti`}. Risulteranno comunque 8 ore.`;
  const exDifettoNo   = `Il dipendente deve lavorare 8 ore. Lavora ${difetto + 1 >= 60 ? `${7 - Math.floor((difetto+1)/60)} ore` : `7 ore e ${60 - difetto - 1} minuti`}. Risulteranno ${difetto + 1 >= 60 ? `${7 - Math.floor((difetto+1)/60)} ore` : `7 ore e ${60 - difetto - 1} minuti`}.`;

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
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-6">

            {/* TITOLO SEZIONE */}
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Soglie di tolleranza sul monte ore</h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Cosa succede se un dipendente lavora di più o di meno rispetto al suo contratto?
              </p>
            </div>

            {/* DUE INPUT AFFIANCATI */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tolleranza in eccesso (minuti)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={120} value={tolleranzaEccesso}
                    onChange={e => setTolleranzaEccesso(Number(e.target.value))}
                    className="w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[16px] sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {[0, 10, 15, 20, 30].map(v => (
                    <button key={v} type="button" onClick={() => setTolleranzaEccesso(v)}
                      className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors ${tolleranzaEccesso === v ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}>
                      {v === 0 ? "Nessuna" : `${v} min`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tolleranza in difetto (minuti)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={120} value={tolleranzaDifetto}
                    onChange={e => setTolleranzaDifetto(Number(e.target.value))}
                    className="w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[16px] sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {[0, 10, 15, 20, 30].map(v => (
                    <button key={v} type="button" onClick={() => setTolleranzaDifetto(v)}
                      className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors ${tolleranzaDifetto === v ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}>
                      {v === 0 ? "Nessuna" : `${v} min`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ESEMPI */}
            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Esempi</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ExampleCard
                  label="Eccesso — entro soglia"
                  color="border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-300"
                  lines={[exEccessoOk, "→ Risulteranno comunque 8 ore."]}
                />
                <ExampleCard
                  label="Eccesso — oltre soglia"
                  color="border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300"
                  lines={[exEccessoNo]}
                />
                <ExampleCard
                  label="Difetto — entro soglia"
                  color="border-blue-100 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/10 text-blue-800 dark:text-blue-300"
                  lines={[exDifettoOk, "→ Risulteranno comunque 8 ore."]}
                />
                <ExampleCard
                  label="Difetto — oltre soglia"
                  color="border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-red-800 dark:text-red-300"
                  lines={[exDifettoNo]}
                />
              </div>
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
