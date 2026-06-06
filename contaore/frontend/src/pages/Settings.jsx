import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { API_URL } from "../api";

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium w-[calc(100%-32px)] sm:w-auto ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
      {type === "success" ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [tolleranza, setTolleranza] = useState(10);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user.role || user.role === "dipendente") { navigate("/dashboard"); return; }
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/company/settings", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.success) setTolleranza(data.tolleranza_straordinario_minuti ?? 10);
    } catch (_) {}
    finally { setLoading(false); }
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/company/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ tolleranza_straordinario_minuti: tolleranza })
      });
      const data = await res.json();
      if (data.success) showToast("Impostazioni salvate");
      else showToast("Errore nel salvataggio", "error");
    } catch (_) {
      showToast("Errore di connessione", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10]">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-4">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={16} /> Dashboard
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shrink-0">
            <SettingsIcon size={18} className="text-white dark:text-zinc-900" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Impostazioni</h1>
            <p className="text-xs text-zinc-500">Configurazione aziendale</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-zinc-400 text-sm">Caricamento...</div>
        ) : (
          <form onSubmit={saveSettings}>
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Presenze e turni</h2>
                <p className="text-xs text-zinc-500">Parametri per il calcolo degli straordinari</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tolleranza straordinari (minuti per lato)
                </label>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Se il dipendente entra/esce entro questa soglia rispetto all'orario del turno, il tempo non viene conteggiato come straordinario. Es. con 10 min: chi timbra alle 7:53 su turno 8:00 non genera straordinario, chi timbra alle 7:49 sì.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={tolleranza}
                    onChange={e => setTolleranza(Number(e.target.value))}
                    className="w-24 h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[16px] sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
                  />
                  <span className="text-sm text-zinc-500">minuti</span>
                </div>
                <div className="flex gap-2 flex-wrap mt-1">
                  {[0, 5, 10, 15].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTolleranza(v)}
                      className={`h-8 px-3 rounded-xl text-xs font-medium transition-colors ${tolleranza === v ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}
                    >
                      {v === 0 ? "Nessuna" : `${v} min`}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full h-12 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-50 transition-opacity"
              >
                {saving ? "Salvataggio..." : "Salva impostazioni"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
