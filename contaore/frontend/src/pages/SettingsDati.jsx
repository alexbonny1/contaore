import { useEffect, useState } from "react";
import { API_URL } from "../api";
import { Toast, Toggle, SettingsHeader } from "../components/SettingsUI";

const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];

function meseLabelFromInput(value) {
  // value = "YYYY-MM"
  if (!value) return null;
  const [y, m] = value.split("-").map(Number);
  return `${MESI[m - 1]} ${y}`;
}

const RETENTION_OPTS = [
  { v: 1,  label: "1 mese" },
  { v: 6,  label: "6 mesi" },
  { v: 12, label: "1 anno" },
  { v: 24, label: "2 anni" },
];

export default function SettingsDati() {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected]   = useState(new Set());
  const [tutti, setTutti]         = useState(true);

  const [modo, setModo]           = useState("mese"); // 'mese' | 'prima'
  const [mese, setMese]           = useState("");      // YYYY-MM
  const [prima, setPrima]         = useState("");      // YYYY-MM-DD
  const [deleting, setDeleting]   = useState(false);

  const [autoEnabled, setAutoEnabled]   = useState(false);
  const [retention, setRetention]       = useState(12);
  const [savingAuto, setSavingAuto]     = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => setToast({ message, type });
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch(`${API_URL}/api/employees`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.success) setEmployees(d.employees || []); }).catch(() => {});
    fetch(`${API_URL}/api/company/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (d.success) { setAutoEnabled(!!d.auto_cleanup_enabled); setRetention(d.auto_cleanup_retention_months ?? 12); }
      }).catch(() => {});
  }, []);

  function toggleEmp(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function elimina() {
    if (modo === "mese" && !mese) { showToast("Seleziona un mese", "error"); return; }
    if (modo === "prima" && !prima) { showToast("Seleziona una data", "error"); return; }
    if (!tutti && selected.size === 0) { showToast("Seleziona almeno un dipendente", "error"); return; }

    const ambito = modo === "mese" ? `del mese ${meseLabelFromInput(mese)}` : `precedenti al ${prima}`;
    const chi = tutti ? "tutti i dipendenti" : `${selected.size} dipendent${selected.size === 1 ? "e" : "i"}`;
    if (!confirm(`Eliminare lo storico ${ambito} per ${chi}? L'operazione non è reversibile.`)) return;

    setDeleting(true);
    try {
      const body = { employee_ids: tutti ? [] : [...selected] };
      if (modo === "mese") body.month = meseLabelFromInput(mese);
      else body.before = prima;
      const res  = await fetch(`${API_URL}/api/admin/cleanup-presences`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || "Errore eliminazione", "error"); return; }
      showToast(`Eliminate ${data.deleted ?? 0} timbrature`);
    } catch (err) { console.log(err); showToast("Errore server", "error"); }
    finally { setDeleting(false); }
  }

  async function salvaAuto(nextEnabled, nextRetention) {
    setSavingAuto(true);
    try {
      const res = await fetch(`${API_URL}/api/company/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ auto_cleanup_enabled: nextEnabled, auto_cleanup_retention_months: nextRetention })
      });
      const data = await res.json();
      if (!data.success) { showToast("Errore salvataggio", "error"); return; }
      showToast("Impostazioni salvate");
    } catch (err) { console.log(err); showToast("Errore server", "error"); }
    finally { setSavingAuto(false); }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <SettingsHeader title="Gestione dati" subtitle="Elimina e pulisci lo storico presenze" />

      {/* ELIMINAZIONE MANUALE */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Elimina storico</h2>
          <p className="text-xs text-zinc-500">Seleziona i dipendenti e il periodo da eliminare</p>
        </div>

        {/* dipendenti */}
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tutti i dipendenti</span>
            <Toggle value={tutti} onChange={setTutti} />
          </label>
          {!tutti && (
            <div className="flex flex-wrap gap-2 pt-1">
              {employees.map(emp => {
                const sel = selected.has(emp.id);
                return (
                  <button key={emp.id} type="button" onClick={() => toggleEmp(emp.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      sel ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-transparent"
                          : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                    }`}>
                    {emp.nome} {emp.cognome}
                  </button>
                );
              })}
              {employees.length === 0 && <p className="text-xs text-zinc-400">Nessun dipendente</p>}
            </div>
          )}
        </div>

        {/* ambito */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Periodo da eliminare</p>
          <div className="flex p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800">
            {[{ id: "mese", label: "Mese specifico" }, { id: "prima", label: "Prima di una data" }].map(o => (
              <button key={o.id} onClick={() => setModo(o.id)}
                className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  modo === o.id ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500"
                }`}>
                {o.label}
              </button>
            ))}
          </div>
          {modo === "mese" ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Verranno eliminate tutte le timbrature del mese scelto</p>
              <input type="month" value={mese} onChange={e => setMese(e.target.value)}
                className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Verranno eliminate tutte le timbrature precedenti alla data scelta</p>
              <input type="date" value={prima} onChange={e => setPrima(e.target.value)}
                className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
            </div>
          )}
        </div>

        <button onClick={elimina} disabled={deleting}
          className="w-full h-11 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium disabled:opacity-50 transition-colors">
          {deleting ? "Eliminazione in corso..." : "Elimina timbrature"}
        </button>
      </div>

      {/* PULIZIA AUTOMATICA */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pulizia automatica</h2>
            <p className="text-xs text-zinc-500">Elimina periodicamente le timbrature più vecchie</p>
          </div>
          <Toggle value={autoEnabled} onChange={(v) => { setAutoEnabled(v); salvaAuto(v, retention); }} />
        </div>

        {autoEnabled && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Per quanto tempo conservare lo storico?</p>
              <p className="text-xs text-zinc-400">Le timbrature più vecchie del periodo scelto vengono eliminate in automatico ogni giorno.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {RETENTION_OPTS.map(o => (
                <button key={o.v} type="button" disabled={savingAuto}
                  onClick={() => { setRetention(o.v); salvaAuto(true, o.v); }}
                  className={`h-9 px-4 rounded-xl text-xs font-medium transition-colors ${
                    retention === o.v ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
              Ad esempio con <strong>6 mesi</strong>, oggi verrebbero conservate solo le timbrature da dicembre 2025 in poi.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
