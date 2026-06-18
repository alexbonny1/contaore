import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings as SettingsIcon, CheckCircle2, XCircle, ArrowLeft,
  BarChart2, Lock, Shield
} from "lucide-react";
import { API_URL } from "../api";
import TwoFactorSettings from "../components/TwoFactorSettings";
import ChangePasswordModal from "../components/ChangePasswordModal";

const STATI_GRAFICO = [
  { key: "presente",     label: "Presente",      color: "#22c55e" },
  { key: "assente",      label: "Assente",       color: "#ef4444" },
  { key: "ritardo",      label: "Ritardo",       color: "#a855f7" },
  { key: "straordinario",label: "Straordinario", color: "#f59e0b" },
  { key: "parziale",     label: "Parziale",      color: "#f97316" },
  { key: "ferie",        label: "Ferie",         color: "#3b82f6" },
  { key: "giustificata", label: "Giustificata",  color: "#6366f1" },
];

const DEFAULT_CHART_PREFS = { showOre: true, showExtra: true, hiddenStati: [] };

function loadChartPrefs() {
  try { return { ...DEFAULT_CHART_PREFS, ...JSON.parse(localStorage.getItem("timbry_chart_prefs") || "{}") }; }
  catch (_) { return DEFAULT_CHART_PREFS; }
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium w-[calc(100%-32px)] sm:w-auto ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
      {type === "success" ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

// ─── Toggle pill ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-700"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-zinc-900 shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // ── Tolleranza
  const [tolleranza,   setTolleranza]   = useState(10);
  const [snapToShift,  setSnapToShift]  = useState(false);
  const [savingToll,   setSavingToll]   = useState(false);

  // ── Grafici
  const [chartPrefs, setChartPrefs] = useState(loadChartPrefs);

  const showToast = (message, type = "success") => setToast({ message, type });

  // ── Load
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user.role || user.role === "dipendente") { navigate("/dashboard"); return; }
    loadAll();
  }, []);

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

  // ── Salva tolleranza
  async function saveTolleranza(e) {
    e.preventDefault();
    setSavingToll(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/company/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ tolleranza_straordinario_minuti: tolleranza, arrotonda_ore_al_turno: snapToShift }),
      });
      const data = await res.json();
      if (data.success) showToast("Tolleranza salvata");
      else showToast("Errore nel salvataggio", "error");
    } catch (_) { showToast("Errore di connessione", "error"); }
    finally { setSavingToll(false); }
  }

  // ── Salva preferenze grafici (localStorage)
  function updateChartPrefs(patch) {
    const next = { ...chartPrefs, ...patch };
    setChartPrefs(next);
    localStorage.setItem("timbry_chart_prefs", JSON.stringify(next));
  }

  function toggleStato(key) {
    const hidden = chartPrefs.hiddenStati.includes(key)
      ? chartPrefs.hiddenStati.filter(s => s !== key)
      : [...chartPrefs.hiddenStati, key];
    updateChartPrefs({ hiddenStati: hidden });
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] flex items-center justify-center">
      <p className="text-sm text-zinc-400">Caricamento...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10]">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-4 pb-12">

        {/* Back */}
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
          <ArrowLeft size={16} /> Dashboard
        </button>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shrink-0">
            <SettingsIcon size={18} className="text-white dark:text-zinc-900" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Impostazioni</h1>
            <p className="text-xs text-zinc-500">Configurazione aziendale</p>
          </div>
        </div>

        {/* ── Sezione 1: Presenze ─────────────────────────────────────────── */}
        <form onSubmit={saveTolleranza}>
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <SettingsIcon size={13} className="text-zinc-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Presenze e turni</h2>
                <p className="text-xs text-zinc-500">Calcolo degli straordinari</p>
              </div>
            </div>

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

            <button type="submit" disabled={savingToll}
              className="w-full h-11 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-50">
              {savingToll ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </form>

        {/* ── Sezione 2: Grafici ───────────────────────────────────────────── */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <BarChart2 size={13} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Grafici dipendente</h2>
              <p className="text-xs text-zinc-500">Personalizza il pannello riepilogo</p>
            </div>
          </div>

          {/* Toggle grafici a barre */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Grafico ore lavorate</p>
                <p className="text-xs text-zinc-400">Ore lavorate vs ore previste per giorno</p>
              </div>
              <Toggle value={chartPrefs.showOre} onChange={v => updateChartPrefs({ showOre: v })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Grafico ritardi/straordinari</p>
                <p className="text-xs text-zinc-400">Minuti di ritardo e straordinario per giorno</p>
              </div>
              <Toggle value={chartPrefs.showExtra} onChange={v => updateChartPrefs({ showExtra: v })} />
            </div>
          </div>

          {/* Stati nel grafico a torta */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Stati nel grafico a torta</p>
            <p className="text-xs text-zinc-400">Scegli quali stati mostrare nel riepilogo del mese</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {STATI_GRAFICO.map(({ key, label, color }) => {
                const visible = !chartPrefs.hiddenStati.includes(key);
                return (
                  <button key={key} type="button" onClick={() => toggleStato(key)}
                    className={`flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-medium border transition-all ${visible ? "border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200" : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#161618] text-zinc-400 dark:text-zinc-600"}`}>
                    <span className="w-2 h-2 rounded-full shrink-0 transition-opacity" style={{ background: visible ? color : "#a1a1aa" }} />
                    {label}
                    {!visible && <span className="ml-auto text-[10px] text-zinc-400">off</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Sezione 3: Cambio Password ──────────────────────────────────────── */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Lock size={13} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cambio password</h2>
              <p className="text-xs text-zinc-500">Aggiorna la tua password</p>
            </div>
          </div>

          <button
            onClick={() => setShowChangePassword(true)}
            className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition duration-200"
          >
            Cambia password
          </button>
        </div>

        {/* ── Sezione 4: 2FA ──────────────────────────────────────────────────── */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <Shield size={13} className="text-green-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Sicurezza</h2>
              <p className="text-xs text-zinc-500">Autenticazione a due fattori</p>
            </div>
          </div>

          <TwoFactorSettings />
        </div>

      </div>

      {/* Modal Cambio Password */}
      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}
