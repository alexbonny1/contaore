import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, Calendar, AlertCircle, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, Send, LogOut, Lock,
  Sun, Moon, TrendingUp, UserCheck, Umbrella, Pencil, Download
} from "lucide-react";
import { API_URL } from "../api";
import ChangePasswordModal from "../components/ChangePasswordModal";
import { usePullToRefresh, PullIndicator } from "../hooks/usePullToRefresh.jsx";

// ─── helpers ─────────────────────────────────────────────────────────────────

function statoBadge(stato, ritardoMinuti = 0) {
  switch (stato) {
    case "presente":      return { label: "Presente",      color: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" };
    case "assente":       return { label: "Assente",       color: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" };
    case "straordinario": return { label: "Straordinario", color: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" };
    case "parziale":      return { label: "Parziale",      color: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" };
    case "ritardo":       return { label: ritardoMinuti > 0 ? `Ritardo ${ritardoMinuti}m` : "Ritardo", color: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" };
    case "ferie":         return { label: "Ferie",         color: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" };
    case "giustificata":  return { label: "Giustificata",  color: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" };
    default:              return { label: stato,           color: "bg-zinc-100 text-zinc-600" };
  }
}

function statoBadgeFerie(stato) {
  switch (stato) {
    case "in_attesa":  return { label: "In attesa",  color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300" };
    case "approvata":  return { label: "Approvata",  color: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" };
    case "rifiutata":  return { label: "Rifiutata",  color: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" };
    default:           return { label: stato,        color: "bg-zinc-100 text-zinc-600" };
  }
}

function fmt(date) {
  return new Date(date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
      {type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {message}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DipendenteDashboard() {

  const navigate = useNavigate();

  const [dark, setDark]                 = useState(false);
  const [loading, setLoading]           = useState(true);
  const [data, setData]                 = useState(null);
  const [toast, setToast]               = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // sezioni aperte
  const [openMonth, setOpenMonth]       = useState(null);
  const [openDay, setOpenDay]           = useState(null);

  // tab attiva: "storico" | "ferie" | "turni"
  const [tab, setTab]                   = useState("storico");

  // form giustificazione
  const [justDay, setJustDay]           = useState("");
  const [justMotivo, setJustMotivo]     = useState("");
  const [savingJust, setSavingJust]     = useState(false);
  const [showJustForm, setShowJustForm] = useState(null); // giorno selezionato

  // form ferie
  const [ferieInizio, setFerieInizio]   = useState("");
  const [ferieFine, setFerieFine]       = useState("");
  const [ferieNote, setFerieNote]       = useState("");
  const [savingFerie, setSavingFerie]   = useState(false);
  const [showFerieForm, setShowFerieForm] = useState(false);
  const [ferie, setFerie]               = useState([]);
  const [pause, setPause]               = useState([]);

  // form richiesta timbratura mancata
  const [missingScanData, setMissingScanData]     = useState("");
  const [missingScanOra, setMissingScanOra]       = useState("");
  const [missingScanTipo, setMissingScanTipo]     = useState("USCITA");
  const [missingScanMotivo, setMissingScanMotivo] = useState("");
  const [savingMissingScan, setSavingMissingScan] = useState(false);
  const [showMissingScanForm, setShowMissingScanForm] = useState(false);
  const [missingScans, setMissingScans]           = useState([]);

  // form richiesta modifica timbratura
  const [showModifyModal, setShowModifyModal]         = useState(false);
  const [modifyPresenzaId, setModifyPresenzaId]       = useState(null);
  const [modifyDatetime, setModifyDatetime]           = useState("");
  const [modifyMotivo, setModifyMotivo]               = useState("");
  const [savingModify, setSavingModify]               = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  useEffect(() => {
    if (dark) { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else       { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [dark]);

  function showToast(msg, type = "success") { setToast({ message: msg, type }); }

  const token = localStorage.getItem("token");
  const user  = JSON.parse(localStorage.getItem("user") || "{}");

  // ── carica dati ──────────────────────────────────────────────────────────
  async function loadMe() {
    try {
      setLoading(true);
      const res  = await fetch(API_URL + "/api/dipendente/me", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!json.success) { navigate("/"); return; }
      setData(json);
    } catch (err) { console.log(err); }
    finally { setLoading(false); }
  }

  async function loadFerie() {
    try {
      const res  = await fetch(API_URL + "/api/dipendente/ferie", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) { setFerie(json.ferie || []); setPause(json.pause || []); }
    } catch (err) { console.log(err); }
  }

  async function loadMissingScans() {
    try {
      const res  = await fetch(API_URL + "/api/requests/missing-scans", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setMissingScans(json.richieste || []);
    } catch (err) { console.log(err); }
  }

  const { pulling, refreshing, distance } = usePullToRefresh(() => Promise.all([loadMe(), loadFerie(), loadMissingScans()]))

  useEffect(() => {
    if (user.role !== "dipendente") { navigate("/"); return; }
    loadMe();
    loadFerie();
    loadMissingScans();
  }, []);

  // ── giustifica assenza ───────────────────────────────────────────────────
  async function inviaGiustificazione(giorno) {
    if (!justMotivo.trim()) { showToast("Inserisci un motivo", "error"); return; }
    setSavingJust(true);
    try {
      const res  = await fetch(API_URL + "/api/dipendente/giustifica", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: giorno, motivo: justMotivo.trim() })
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.message || json.error || "Errore", "error");
        return;
      }
      showToast("Giustificazione inviata");
      setShowJustForm(null); setJustMotivo("");
      loadMe();
    } catch (err) { console.log(err); showToast("Errore server", "error"); }
    finally { setSavingJust(false); }
  }

  // ── richiesta ferie ──────────────────────────────────────────────────────
  async function inviaRichiestaFerie(e) {
    e.preventDefault();
    setSavingFerie(true);
    try {
      const res  = await fetch(API_URL + "/api/dipendente/ferie", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data_inizio: ferieInizio, data_fine: ferieFine, note: ferieNote || undefined })
      });
      const json = await res.json();
      if (!json.success) { showToast(json.message || json.error || "Errore", "error"); return; }
      showToast("Richiesta ferie inviata — in attesa di approvazione");
      setFerieInizio(""); setFerieFine(""); setFerieNote(""); setShowFerieForm(false);
      loadFerie();
    } catch (err) { console.log(err); showToast("Errore server", "error"); }
    finally { setSavingFerie(false); }
  }

  // ── cancella richiesta ferie ─────────────────────────────────────────────
  async function cancellaFerie(id) {
    if (!confirm("Cancellare questa richiesta?")) return;
    try {
      const res  = await fetch(API_URL + "/api/dipendente/ferie/" + id, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) { showToast(json.message || "Errore", "error"); return; }
      showToast("Richiesta cancellata");
      loadFerie();
    } catch (err) { console.log(err); showToast("Errore server", "error"); }
  }

  // ── invia richiesta timbratura mancata ───────────────────────────────────
  async function inviaMissingScan(e) {
    e.preventDefault();
    if (!missingScanData) { showToast("Seleziona una data", "error"); return; }
    if (!missingScanOra) { showToast("Inserisci l'ora", "error"); return; }
    if (!missingScanMotivo.trim()) { showToast("Inserisci un motivo", "error"); return; }
    setSavingMissingScan(true);
    try {
      const res = await fetch(API_URL + "/api/requests/missing-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: missingScanData, tipo: missingScanTipo, ora: missingScanOra, motivo: missingScanMotivo.trim() })
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.message || json.error || "Errore", "error");
        return;
      }
      showToast("Richiesta inviata — in attesa di approvazione");
      setMissingScanData(""); setMissingScanOra(""); setMissingScanMotivo(""); setShowMissingScanForm(false);
      loadMissingScans();
    } catch (err) { console.log(err); showToast("Errore server", "error"); }
    finally { setSavingMissingScan(false); }
  }

  // ── apri modal modifica timbratura ───────────────────────────────────────
  function openModifyModal(presenzaId, dateStr, timeStr) {
    setModifyPresenzaId(presenzaId);
    setModifyDatetime(timeStr && dateStr ? `${dateStr}T${timeStr}` : (dateStr ? `${dateStr}T09:00` : ""));
    setModifyMotivo("");
    setShowModifyModal(true);
  }

  // ── invia richiesta modifica timbratura ───────────────────────────────────
  async function inviaModificaScan(e) {
    e.preventDefault();
    if (!modifyPresenzaId || !modifyDatetime) { showToast("Compila tutti i campi", "error"); return; }
    if (!modifyMotivo.trim() || modifyMotivo.trim().length < 3) { showToast("Motivo troppo breve", "error"); return; }
    setSavingModify(true);
    try {
      const res  = await fetch(API_URL + "/api/requests/modify-scan", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          presenza_id:    modifyPresenzaId,
          nuovo_datetime: new Date(modifyDatetime).toISOString(),
          motivo:         modifyMotivo.trim()
        })
      });
      const json = await res.json();
      if (!json.success) { showToast(json.error || "Errore", "error"); return; }
      showToast("Richiesta inviata");
      setShowModifyModal(false);
      loadMissingScans();
    } catch (err) {
      console.log(err);
      showToast("Errore server", "error");
    } finally {
      setSavingModify(false);
    }
  }

  // ── cancella richiesta timbratura mancata ────────────────────────────────
  async function cancellaMissingScan(id) {
    if (!confirm("Cancellare questa richiesta?")) return;
    try {
      const res  = await fetch(API_URL + "/api/requests/missing-scans/" + id, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) { showToast(json.message || "Errore", "error"); return; }
      showToast("Richiesta cancellata");
      loadMissingScans();
    } catch (err) { console.log(err); showToast("Errore server", "error"); }
  }

  function logout() { localStorage.clear(); navigate("/"); }

  async function downloadMonthPDF(mese) {
    try {
      const res = await fetch(API_URL + "/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employee_ids: [employee.id], month: mese })
      });
      if (!res.ok) { showToast("Errore generazione PDF", "error"); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `Timbry_${employee.cognome}_${employee.nome}_${mese.replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.log(err);
      showToast("Errore download PDF", "error");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] flex items-center justify-center">
        <p className="text-zinc-400">Caricamento...</p>
      </div>
    );
  }

  if (!data) return null;

  const { employee, shifts, history_days, stats, giustificazioni } = data;
  const inPausa = !!data.in_pausa;

  // raggruppa per mese
  const months = {};
  history_days.forEach(d => {
    const mk = new Date(d.giorno).toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    if (!months[mk]) months[mk] = [];
    months[mk].push(d);
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10]">

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-5 h-14 sm:h-16 flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <p className="text-[10px] sm:text-xs text-zinc-400 font-mono uppercase tracking-widest">Timbry</p>
            <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {employee.nome} {employee.cognome}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button onClick={() => setShowChangePassword(true)} className="flex items-center gap-1 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-4 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 text-xs sm:text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
              <Lock size={12} className="sm:w-[14px] sm:h-[14px]" />
              <span className="hidden xs:inline">Password</span>
            </button>
            <button onClick={() => setDark(d => !d)} className="flex items-center justify-center h-9 sm:h-10 w-9 sm:w-10 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={logout} className="flex items-center gap-1 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-4 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium">
              <LogOut size={12} className="sm:w-[14px] sm:h-[14px]" />
              <span className="hidden xs:inline">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-5 py-5 sm:py-7">
        <PullIndicator pulling={pulling} refreshing={refreshing} distance={distance} />

        {/* PAUSA BANNER */}
        {inPausa && (
          <div className="mb-4 sm:mb-6 flex items-center gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
            <span className="text-xl sm:text-2xl">☕</span>
            <div>
              <p className="text-sm sm:text-base font-semibold text-amber-800 dark:text-amber-300">Sei in pausa</p>
              <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">Il tuo turno riprende dopo la pausa programmata</p>
            </div>
          </div>
        )}

        {/* STATS */}
        {(() => {
          const todayStr = new Date().toISOString().split("T")[0];
          const ferieInCorso = [
            ...ferie.filter(f => f.stato === "approvata" && f.data_inizio <= todayStr && f.data_fine >= todayStr),
            ...pause.filter(p => p.data_inizio <= todayStr && p.data_fine >= todayStr)
          ].reduce((tot, f) => tot + Math.round((new Date(f.data_fine) - new Date(todayStr)) / 86400000) + 1, 0);
          const ferieProssime = [
            ...ferie.filter(f => f.stato === "approvata" && f.data_inizio > todayStr),
            ...pause.filter(p => p.data_inizio > todayStr)
          ].reduce((tot, f) => tot + Math.round((new Date(f.data_fine) - new Date(f.data_inizio)) / 86400000) + 1, 0);
          return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { icon: Clock,     label: "Ore questo mese",  value: `${stats.ore_mese_corrente}h` },
            { icon: UserCheck, label: "Giorni assenti",    value: stats.giorni_assenti },
            { icon: TrendingUp,label: "Ore straordinario", value: `${stats.ore_straordinario}h` },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl sm:rounded-2xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4">
                <Icon size={14} className="sm:w-4 sm:h-4 text-zinc-400 mb-1.5 sm:mb-2" />
                <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{s.value}</p>
                <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5 leading-tight">{s.label}</p>
              </div>
            );
          })}
          {/* Ferie tile: in corso + prossime separati */}
          <div className="rounded-xl sm:rounded-2xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4">
            <Umbrella size={14} className="sm:w-4 sm:h-4 text-zinc-400 mb-1.5 sm:mb-2" />
            <div className="flex items-end gap-3">
              <div>
                <p className={`text-xl sm:text-2xl font-semibold ${ferieInCorso > 0 ? "text-orange-500" : "text-zinc-900 dark:text-zinc-100"}`}>{ferieInCorso}</p>
                <p className="text-[10px] text-zinc-400 leading-tight">In corso</p>
              </div>
              <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
              <div>
                <p className={`text-xl sm:text-2xl font-semibold ${ferieProssime > 0 ? "text-blue-500" : "text-zinc-900 dark:text-zinc-100"}`}>{ferieProssime}</p>
                <p className="text-[10px] text-zinc-400 leading-tight">Prossime</p>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-zinc-400 mt-0.5 leading-tight">Giorni ferie</p>
          </div>
        </div>
          );
        })()}

        {/* TABS */}
        <div className="flex gap-1.5 sm:gap-2 mb-5 sm:mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: "storico", label: "Storico presenze", shortLabel: "Storico" },
            { id: "ferie",   label: "Ferie", shortLabel: "Ferie" },
            { id: "richieste",   label: "Richieste", shortLabel: "Richieste" },
            { id: "turni",   label: "I miei turni", shortLabel: "Turni" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black" : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800"}`}>
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* ══════════ TAB: STORICO ══════════ */}
        {tab === "storico" && (
          <div className="space-y-3 sm:space-y-4">
            {Object.keys(months).length === 0 && (
              <div className="text-center py-12 sm:py-16 text-sm sm:text-base text-zinc-400">Nessuna presenza registrata</div>
            )}
            {Object.entries(months).map(([mese, giorni]) => {
              const oreM   = Number(giorni.reduce((s, d) => s + d.ore_totali, 0).toFixed(2));
              const assM   = giorni.filter(d => d.assente).length;
              const isOpen = openMonth === mese;
              return (
                <div key={mese} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 overflow-hidden">

                  {/* header mese */}
                  <div className="w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 gap-2">
                    <button className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 text-left" onClick={() => setOpenMonth(isOpen ? null : mese)}>
                      <Calendar size={14} className="sm:w-4 sm:h-4 text-zinc-400 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 capitalize truncate">{mese}</span>
                    </button>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <span className="text-[10px] sm:text-xs text-zinc-400 whitespace-nowrap">{oreM}h</span>
                      {assM > 0 && <span className="text-[10px] sm:text-xs text-red-500 whitespace-nowrap hidden xs:inline">{assM} ass.</span>}
                      <button
                        onClick={() => downloadMonthPDF(mese)}
                        className="flex items-center gap-1 h-8 px-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[11px] font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        title={`Scarica PDF ${mese}`}
                      >
                        <Download size={12} />
                        <span className="hidden sm:inline">PDF</span>
                      </button>
                      <button onClick={() => setOpenMonth(isOpen ? null : mese)} className="flex items-center justify-center h-8 w-8 rounded-xl text-zinc-400">
                        {isOpen ? <ChevronUp size={14} className="sm:w-4 sm:h-4" /> : <ChevronDown size={14} className="sm:w-4 sm:h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* giorni */}
                  {isOpen && (
                    <div className="border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                      {giorni.map(g => {
                        const { label, color } = statoBadge(g.stato, g.ritardo_minuti);
                        const isDayOpen = openDay === g.giorno;
                        // controlla se esiste già una giustificazione per questo giorno
                        const giust = giustificazioni.find(j => j.data === g.giorno);
                        return (
                          <div key={g.giorno}>
                            <button className="w-full flex items-center justify-between px-6 py-3" onClick={() => setOpenDay(isDayOpen ? null : g.giorno)}>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-zinc-700 dark:text-zinc-300 w-24 text-left">
                                  {new Date(g.giorno).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" })}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>{label}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                {g.ore_totali > 0 && <span className="text-xs text-zinc-400">{g.ore_totali}h</span>}
                                {isDayOpen ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
                              </div>
                            </button>

                            {/* dettaglio giorno */}
                            {isDayOpen && (
                              <div className="px-6 pb-4 bg-zinc-50 dark:bg-zinc-900/50">

                                {/* coppie entrata/uscita */}
                                {g.coppie.length > 0 ? (
                                  <div className="space-y-1 mb-3">
                                    {g.coppie.map((c, i) => (
                                      <div key={i} className="flex items-center gap-2 text-xs text-zinc-500">
                                        <span className="text-green-600 font-medium">↑ {c.entrata || "—"}</span>
                                        {c.entrata_id && (
                                          <button onClick={() => openModifyModal(c.entrata_id, g.giorno, c.entrata)}
                                            className="text-zinc-300 hover:text-blue-500 transition-colors flex-shrink-0">
                                            <Pencil size={10} />
                                          </button>
                                        )}
                                        <span className="text-zinc-300">|</span>
                                        <span className="text-red-500 font-medium">↓ {c.uscita || "ancora dentro"}</span>
                                        {c.uscita && c.uscita_giorno_dopo && (
                                          <span className="text-indigo-500 dark:text-indigo-400 font-medium">+1</span>
                                        )}
                                        {c.uscita_id && (
                                          <button onClick={() => openModifyModal(c.uscita_id, g.giorno, c.uscita_giorno_dopo ? null : c.uscita)}
                                            className="text-zinc-300 hover:text-blue-500 transition-colors flex-shrink-0">
                                            <Pencil size={10} />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-zinc-400 mb-3">Nessuna timbratura</p>
                                )}

                                {/* pulsante giustifica — solo se assente e non già giustificato */}
                                {g.assente && !giust && (
                                  <div>
                                    {showJustForm === g.giorno ? (
                                      <div className="mt-3 space-y-2">
                                        <textarea
                                          rows={2}
                                          placeholder="Motivo dell'assenza..."
                                          value={justMotivo}
                                          onChange={e => setJustMotivo(e.target.value)}
                                          className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none resize-none"
                                        />
                                        <div className="flex gap-2">
                                          <button onClick={() => inviaGiustificazione(g.giorno)} disabled={savingJust}
                                            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-xs font-medium disabled:opacity-50">
                                            <Send size={12} /> {savingJust ? "Invio..." : "Invia"}
                                          </button>
                                          <button onClick={() => { setShowJustForm(null); setJustMotivo(""); }}
                                            className="h-9 px-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs">
                                            Annulla
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button onClick={() => setShowJustForm(g.giorno)}
                                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mt-1">
                                        <AlertCircle size={13} /> Giustifica assenza
                                      </button>
                                    )}
                                  </div>
                                )}

                                {/* stato giustificazione esistente */}
                                {giust && (
                                  <div className={`mt-2 px-3 py-2 rounded-xl text-xs ${statoBadge("giustificata").color}`}>
                                    <strong>Giustificazione {statoBadgeFerie(giust.stato).label.toLowerCase()}</strong>
                                    {giust.motivo && <span className="text-zinc-500 ml-1">— {giust.motivo}</span>}
                                  </div>
                                )}

                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════ TAB: FERIE ══════════ */}
        {tab === "ferie" && (
          <div>

            {/* ── FERIE AUTORIZZATE ───────────────────────────────────────── */}
            {(() => {
              const autorizzate = [
                ...ferie
                  .filter(f => f.stato === "approvata")
                  .map(f => ({ ...f, tipo: "personale" })),
                ...pause.map(p => ({ ...p, stato: "approvata" }))
              ].sort((a, b) => a.data_inizio < b.data_inizio ? 1 : -1);

              return (
                <div className="mb-6 sm:mb-8">
                  <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                    Ferie autorizzate
                  </h3>
                  {autorizzate.length === 0 ? (
                    <div className="rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] px-4 py-4 text-sm text-zinc-400">
                      Nessuna ferie autorizzata
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {autorizzate.map(f => {
                        const isAziendale = f.tipo === "pausa_aziendale";
                        const today = new Date().toISOString().split("T")[0];
                        const isOngoing = f.data_inizio <= today && f.data_fine >= today;
                        const isFuture  = f.data_inizio > today;
                        const giorni = Math.round((new Date(f.data_fine) - new Date(f.data_inizio)) / 86400000) + 1;
                        const daysLeft    = isOngoing ? Math.round((new Date(f.data_fine) - new Date(today)) / 86400000) + 1 : null;
                        const daysToStart = isFuture  ? Math.round((new Date(f.data_inizio) - new Date(today)) / 86400000) : null;
                        return (
                          <div key={f.id}
                            className={`rounded-xl sm:rounded-2xl border px-4 sm:px-5 py-3 sm:py-4 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 xs:gap-0 ${
                              isOngoing
                                ? "border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10"
                                : isFuture
                                  ? "border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10"
                                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618]"
                            }`}>
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <Umbrella size={13} className={isOngoing ? "text-orange-500" : isFuture ? "text-blue-500" : "text-zinc-400"} />
                                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                  {fmt(f.data_inizio)} → {fmt(f.data_fine)}
                                </span>
                                <span className="text-xs text-zinc-400">({giorni} {giorni === 1 ? "giorno" : "giorni"})</span>
                              </div>
                              <p className="text-xs text-zinc-500 ml-5">
                                {isAziendale ? `Chiusura aziendale — ${f.motivo}` : (f.note || "Ferie personali")}
                              </p>
                              {isOngoing && (
                                <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 ml-5 mt-1">
                                  {daysLeft === 1 ? "Ultimo giorno oggi" : `Ancora ${daysLeft} giorni`}
                                </p>
                              )}
                              {isFuture && (
                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 ml-5 mt-1">
                                  {daysToStart === 1 ? "Inizia domani" : daysToStart === 0 ? "Inizia oggi" : `Inizia tra ${daysToStart} giorni`}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-5 xs:ml-0">
                              {isAziendale
                                ? <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">Aziendale</span>
                                : <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300">Approvata</span>
                              }
                              {isOngoing && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">In corso</span>}
                              {isFuture  && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">Prossima</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── NUOVA RICHIESTA ─────────────────────────────────────────── */}
            {!showFerieForm && (
              <button onClick={() => setShowFerieForm(true)}
                className="flex items-center gap-1.5 sm:gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium mb-5 sm:mb-6">
                <Umbrella size={14} className="sm:w-[15px] sm:h-[15px]" />
                <span className="hidden xs:inline">Nuova richiesta ferie</span>
                <span className="xs:hidden">Nuova richiesta</span>
              </button>
            )}

            {showFerieForm && (
              <form onSubmit={inviaRichiestaFerie} className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Richiesta ferie</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Dal</p>
                    <input type="date" value={ferieInizio} onChange={e => setFerieInizio(e.target.value)}
                      className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm"
                      required />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Al</p>
                    <input type="date" value={ferieFine} onChange={e => setFerieFine(e.target.value)}
                      className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm"
                      required />
                  </div>
                </div>
                <textarea rows={2} placeholder="Note (opzionale)" value={ferieNote} onChange={e => setFerieNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none resize-none mb-4" />
                <div className="flex gap-2">
                  <button type="submit" disabled={savingFerie}
                    className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium disabled:opacity-50">
                    <Send size={14} /> {savingFerie ? "Invio..." : "Invia richiesta"}
                  </button>
                  <button type="button" onClick={() => setShowFerieForm(false)}
                    className="h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">
                    Annulla
                  </button>
                </div>
              </form>
            )}

            {/* ── TUTTE LE RICHIESTE (in attesa / rifiutate) ──────────────── */}
            {ferie.filter(f => f.stato !== "approvata").length > 0 && (
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  Richieste in corso
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {ferie.filter(f => f.stato !== "approvata").map(f => {
                    const { label, color } = statoBadgeFerie(f.stato);
                    return (
                      <div key={f.id} className="rounded-xl sm:rounded-2xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 px-4 sm:px-5 py-3 sm:py-4 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 xs:gap-0">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Umbrella size={14} className="text-zinc-400" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {fmt(f.data_inizio)} → {fmt(f.data_fine)}
                            </span>
                          </div>
                          {f.note && <p className="text-xs text-zinc-400">{f.note}</p>}
                          <p className="text-xs text-zinc-400 mt-0.5">Richiesta il {fmt(f.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>
                          {f.stato === "in_attesa" && (
                            <button onClick={() => cancellaFerie(f.id)} className="text-xs text-red-500 hover:text-red-700">
                              Cancella
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ TAB: RICHIESTE ══════════ */}
        {tab === "richieste" && (
          <div className="space-y-6">
            {/* SEZIONE TIMBRATURA MANCATA */}
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Richiedi timbratura mancata</h3>
              
              {!showMissingScanForm && (
                <button onClick={() => setShowMissingScanForm(true)}
                  className="flex items-center gap-1.5 sm:gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium mb-5 sm:mb-6">
                  <Clock size={14} className="sm:w-[15px] sm:h-[15px]" /> Nuova richiesta
                </button>
              )}

              {showMissingScanForm && (
                <form onSubmit={inviaMissingScan} className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Richiesta timbratura mancata</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    Richiedi al titolare di aggiungere una timbratura di entrata o uscita che hai dimenticato.
                  </p>
                  <div className="mb-4">
                    <p className="text-xs text-zinc-400 mb-1">Tipo timbratura</p>
                    <div className="flex gap-3">
                      {['USCITA', 'ENTRATA'].map(t => (
                        <button key={t} type="button"
                          onClick={() => setMissingScanTipo(t)}
                          className={`flex-1 h-11 rounded-2xl border text-sm font-medium transition-all ${
                            missingScanTipo === t
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100'
                              : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                          }`}>
                          {t === 'USCITA' ? '🔴 Uscita' : '🟢 Entrata'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Data</p>
                      <input type="date" value={missingScanData} onChange={e => setMissingScanData(e.target.value)}
                        className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm"
                        required />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Ora {missingScanTipo === 'USCITA' ? 'uscita' : 'entrata'}</p>
                      <input type="time" value={missingScanOra} onChange={e => setMissingScanOra(e.target.value)}
                        className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm"
                        required />
                    </div>
                  </div>
                  <textarea rows={2} placeholder="Motivo della richiesta (es: Ho dimenticato di timbrare)" value={missingScanMotivo} onChange={e => setMissingScanMotivo(e.target.value)}
                    className="w-full px-3 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none resize-none mb-4" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={savingMissingScan}
                      className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium disabled:opacity-50">
                      <Send size={14} /> {savingMissingScan ? "Invio..." : "Invia richiesta"}
                    </button>
                    <button type="button" onClick={() => setShowMissingScanForm(false)}
                      className="h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">
                      Annulla
                    </button>
                  </div>
                </form>
              )}

              {missingScans.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-sm">Nessuna richiesta</div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {missingScans.map(m => {
                    const { label, color } = statoBadgeFerie(m.stato);
                    return (
                      <div key={m.id} className="rounded-xl sm:rounded-2xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 px-4 sm:px-5 py-3 sm:py-4 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 xs:gap-0">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Clock size={14} className="text-zinc-400 shrink-0" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {m.tipo === 'ENTRATA' ? '🟢' : '🔴'} {m.tipo || 'USCITA'} — {fmt(m.data)} alle {m.ora_uscita}
                            </span>
                          </div>
                          {m.motivo && <p className="text-xs text-zinc-400 ml-5">{m.motivo}</p>}
                          <p className="text-xs text-zinc-400 mt-0.5 ml-5">
                            Richiesta il {fmt(m.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-5 xs:ml-0 shrink-0">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>
                          {m.stato === "in_attesa" && (
                            <button onClick={() => cancellaMissingScan(m.id)} className="text-xs text-red-500 hover:text-red-700">
                              Cancella
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ TAB: TURNI ══════════ */}
        {tab === "turni" && (
          <div>
            {!employee.turni_attivi ? (
              <div className="text-center py-16 text-zinc-400">
                <Clock size={32} className="mx-auto mb-3 opacity-30" />
                <p>Nessun turno configurato per il tuo profilo</p>
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-16 text-zinc-400">Nessun turno assegnato</div>
            ) : (
              <div className="space-y-3">
                {["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"].map(giorno => {
                  const dayShifts = shifts.filter(s => s.giorno_settimana === giorno);
                  if (!dayShifts.length) return null;
                  return (
                    <div key={giorno} className="rounded-2xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 px-5 py-4">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{giorno}</p>
                      {dayShifts.map(s => (
                        <div key={s.id} className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300 flex-wrap">
                          <Sun size={14} className="text-zinc-400 flex-shrink-0" />
                          <span>
                            {s.ingresso_1?.slice(0,5)} – {s.uscita_1?.slice(0,5)}
                            {s.ingresso_2 && ` / ${s.ingresso_2.slice(0,5)} – ${s.uscita_2?.slice(0,5)}`}
                          </span>
                          {s.uscita_1 && s.ingresso_1 && s.uscita_1 < s.ingresso_1 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Notturno</span>
                          )}
                          {s.turno_nome && <span className="text-xs text-zinc-400">({s.turno_nome})</span>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>

    {showChangePassword && (
      <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
    )}

    {/* MODAL MODIFICA TIMBRATURA */}
    {showModifyModal && (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Richiesta modifica</h3>
          <p className="text-xs text-zinc-400 mb-5">Indica il nuovo orario corretto e il motivo della modifica</p>
          <form onSubmit={inviaModificaScan} className="space-y-4">
            <div>
              <p className="text-xs text-zinc-400 mb-2">Nuovo orario</p>
              <input
                type="datetime-local"
                value={modifyDatetime}
                onChange={e => setModifyDatetime(e.target.value)}
                required
                className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
              />
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-2">Motivo</p>
              <textarea
                rows={2}
                placeholder="Es: Ho timbrato l'orario sbagliato"
                value={modifyMotivo}
                onChange={e => setModifyMotivo(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={savingModify}
                className="flex-1 h-11 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                <Send size={14} /> {savingModify ? "Invio..." : "Invia richiesta"}
              </button>
              <button type="button" onClick={() => setShowModifyModal(false)}
                className="flex-1 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300">
                Annulla
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </>
  );
}