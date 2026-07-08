import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, Calendar, AlertCircle, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, Send, LogOut, Lock,
  Sun, TrendingUp, UserCheck, Umbrella, Pencil, Download,
  User, Shield, ChevronLeft, Trash2, Bell
} from "lucide-react";
import { API_URL, apiFetch } from "../api";
import ChangePasswordModal from "../components/ChangePasswordModal";
import DipendenteBottomNav from "../components/DipendenteBottomNav";
import { SettingRow, SettingsGroup } from "../components/SettingsUI";
import { ThemeRow } from "../components/ThemeSelector";
import PushPrompt from "../components/PushPrompt";
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
    <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
      {type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {message}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DipendenteDashboard() {

  const navigate = useNavigate();

  const [loading, setLoading]           = useState(true);
  const [data, setData]                 = useState(null);
  const [toast, setToast]               = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // sezioni aperte
  const [openMonth, setOpenMonth]       = useState(null);

  // tab attiva: "presenze" | "ferie" | "richieste" | "profilo"
  const [tab, setTab]                   = useState("presenze");

  // form giustificazione
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

  // sottomenu richieste: "timbratura" | "permessi" | "turni"
  const [requestsSubTab, setRequestsSubTab]           = useState("timbratura");

  // form richiesta permesso
  const [permesoDataUscita, setPermesoDataUscita]     = useState("");
  const [permesoOraUscita, setPermesoOraUscita]       = useState("");
  const [permesoDataEntrata, setPermesoDataEntrata]   = useState("");
  const [permesoOraEntrata, setPermesoOraEntrata]     = useState("");
  const [permesoTipo, setPermesoTipo]                 = useState("personale");
  const [permesoMotivo, setPermesoMotivo]             = useState("");
  const [savingPermeso, setSavingPermeso]             = useState(false);
  const [showPermesoForm, setShowPermesoForm]         = useState(false);
  const [permesi, setPermesi]                         = useState([]);

  // form richiesta modifica turni
  const [turniDataDal, setTurniDataDal]               = useState("");
  const [turniDataAl, setTurniDataAl]                 = useState("");
  const [turniGiorniSelezionati, setTurniGiorniSelezionati] = useState({
    lunedi: false, martedi: false, mercoledi: false, giovedi: false,
    venerdi: false, sabato: false, domenica: false
  });
  const [turniOrari, setTurniOrari]                   = useState({}); // { "lunedi": { ingresso, uscita }, ... }
  const [turniMotivo, setTurniMotivo]                 = useState("");
  const [savingTurni, setSavingTurni]                 = useState(false);
  const [showTurniForm, setShowTurniForm]             = useState(false);
  const [richiesteTurni, setRichiesteTurni]           = useState([]);

  // profilo sub-view: null (hub) | 'profilo' | 'sicurezza' | 'notifiche'
  const [profiloSub, setProfiloSub]                   = useState(null);

  // profilo edit
  const [editingProfile, setEditingProfile]           = useState(false);
  const [editNome, setEditNome]                       = useState('');
  const [editCognome, setEditCognome]                 = useState('');
  const [editEmail, setEditEmail]                     = useState('');
  const [savingProfile, setSavingProfile]             = useState(false);

  // elimina account
  const [showDeleteAccount, setShowDeleteAccount]     = useState(false);
  const [deletePassword, setDeletePassword]           = useState('');
  const [deletingAccount, setDeletingAccount]         = useState(false);

  // 2FA
  const [twoFaEnabled, setTwoFaEnabled]               = useState(false);
  const [loadingTwoFa, setLoadingTwoFa]               = useState(false);

  // promemoria timbratura (self-service)
  const [editPromemoriaEntrata, setEditPromemoriaEntrata] = useState(null);
  const [editPromemoriaUscita, setEditPromemoriaUscita]   = useState(null);
  const [savingPromemoria, setSavingPromemoria]           = useState(false);

  function showToast(msg, type = "success") { setToast({ message: msg, type }); }

  const token = localStorage.getItem("token");
  const user  = JSON.parse(localStorage.getItem("user") || "{}");

  // ── carica dati ──────────────────────────────────────────────────────────
  async function loadMe() {
    try {
      setLoading(true);
      const res  = await fetch(API_URL + "/api/dipendente/me", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.error === 'SESSION_EXPIRED') {
        localStorage.clear();
        window.location.href = '/?session_expired=1';
        return;
      }
      if (!json.success) { navigate("/"); return; }
      setData(json);
    } catch (err) { }
    finally { setLoading(false); }
  }

  async function loadFerie() {
    try {
      const res  = await fetch(API_URL + "/api/dipendente/ferie", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) { setFerie(json.ferie || []); setPause(json.pause || []); }
    } catch (err) { }
  }

  async function loadMissingScans() {
    try {
      const res  = await fetch(API_URL + "/api/requests/missing-scans", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setMissingScans(json.richieste || []);
    } catch (err) { }
  }

  async function loadPermesi() {
    try {
      const res  = await fetch(API_URL + "/api/dipendente/richieste/permessi", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setPermesi(json.richieste || []);
    } catch (err) { }
  }

  async function loadRichiesteTurni() {
    try {
      const res  = await fetch(API_URL + "/api/dipendente/richieste/turni", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setRichiesteTurni(json.richieste || []);
    } catch (err) { }
  }

  async function loadUserSettings() {
    try {
      const res  = await fetch(API_URL + "/api/user/settings", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) setTwoFaEnabled(json.settings?.two_factor_enabled || false);
    } catch (err) { }
  }

  async function saveProfile() {
    if (!editNome.trim()) { showToast("Il nome è obbligatorio", "error"); return; }
    if (editEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
      showToast("Email non valida", "error"); return;
    }
    setSavingProfile(true);
    try {
      const res  = await fetch(API_URL + "/api/dipendente/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nome: editNome.trim(), cognome: editCognome.trim(), email: editEmail.trim() || null })
      });
      const json = await res.json();
      if (!json.success) { showToast(json.error || "Errore salvataggio", "error"); return; }
      if (json.credenziali_reinviate) {
        showToast("Profilo aggiornato — verrai disconnesso...");
        setTimeout(() => { localStorage.clear(); navigate("/"); }, 2500);
        return;
      }
      showToast("Profilo aggiornato");
      setEditingProfile(false);
      loadMe();
    } catch (err) { showToast("Errore server", "error"); }
    finally { setSavingProfile(false); }
  }

  async function savePromemoria() {
    setSavingPromemoria(true);
    try {
      const res  = await fetch(API_URL + "/api/dipendente/promemoria", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          promemoria_entrata_minuti: editPromemoriaEntrata,
          promemoria_uscita_minuti:  editPromemoriaUscita
        })
      });
      const json = await res.json();
      if (!json.success) { showToast(json.error || "Errore salvataggio", "error"); return; }
      showToast("Preferenze notifiche aggiornate");
      loadMe();
    } catch (err) { showToast("Errore server", "error"); }
    finally { setSavingPromemoria(false); }
  }

  async function deleteAccount() {
    if (!deletePassword) { showToast("Inserisci la password", "error"); return; }
    setDeletingAccount(true);
    try {
      const res  = await fetch(API_URL + "/api/dipendente/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: deletePassword })
      });
      const json = await res.json();
      if (!json.success) { showToast(json.error === 'WRONG_PASSWORD' ? "Password errata" : (json.error || "Errore"), "error"); return; }
      localStorage.clear();
      navigate("/");
    } catch (err) { showToast("Errore server", "error"); }
    finally { setDeletingAccount(false); }
  }

  async function toggleTwoFa() {
    setLoadingTwoFa(true);
    try {
      const res  = await fetch(API_URL + "/api/user/toggle-2fa", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !twoFaEnabled })
      });
      const json = await res.json();
      if (json.success) setTwoFaEnabled(json.two_factor_enabled);
      else showToast(json.error || "Errore", "error");
    } catch (err) { showToast("Errore server", "error"); }
    finally { setLoadingTwoFa(false); }
  }

  const { pulling, refreshing, distance } = usePullToRefresh(() => Promise.all([loadMe(), loadFerie(), loadMissingScans(), loadPermesi(), loadRichiesteTurni()]))

  useEffect(() => {
    if (user.role !== "dipendente") { navigate("/"); return; }
    loadMe();
    loadFerie();
    loadMissingScans();
    loadPermesi();
    loadRichiesteTurni();
    loadUserSettings();
  }, []);

  // Controlla validità sessione ogni 30s — se la password è cambiata su un altro
  // dispositivo apiFetch rileva SESSION_EXPIRED e reindirizza automaticamente al login
  useEffect(() => {
    const i = setInterval(() => apiFetch('/api/dipendente/me').catch(() => {}), 30000);
    return () => clearInterval(i);
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
    } catch (err) { showToast("Errore server", "error"); }
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
    } catch (err) { showToast("Errore server", "error"); }
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
    } catch (err) { showToast("Errore server", "error"); }
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
    } catch (err) { showToast("Errore server", "error"); }
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
    } catch (err) { showToast("Errore server", "error"); }
  }

  // ── invia richiesta permesso ─────────────────────────────────────────────
  async function inviPermesso(e) {
    e.preventDefault();
    if (!permesoMotivo.trim()) { showToast("Inserisci il motivo (obbligatorio)", "error"); return; }
    if (!permesoDataUscita && !permesoDataEntrata) { showToast("Inserisci almeno una data", "error"); return; }
    setSavingPermeso(true);
    try {
      const res = await fetch(API_URL + "/api/dipendente/richieste/permesso", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          data_uscita: permesoDataUscita || null,
          ora_uscita: permesoOraUscita || null,
          data_entrata: permesoDataEntrata || null,
          ora_entrata: permesoOraEntrata || null,
          tipo: permesoTipo,
          motivo: permesoMotivo.trim()
        })
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.message || json.error || "Errore", "error");
        return;
      }
      showToast("Richiesta permesso inviata — in attesa di approvazione");
      setPermesoDataUscita(""); setPermesoOraUscita(""); setPermesoDataEntrata(""); setPermesoOraEntrata(""); setPermesoMotivo(""); setShowPermesoForm(false);
      // Reload permessi se la funzione esiste
      if (typeof loadPermesi === 'function') loadPermesi();
    } catch (err) { showToast("Errore server", "error"); }
    finally { setSavingPermeso(false); }
  }

  // ── cancella richiesta permesso ──────────────────────────────────────────
  async function cancellaPermesso(id) {
    if (!confirm("Cancellare questa richiesta?")) return;
    try {
      const res  = await fetch(API_URL + "/api/dipendente/richieste/permesso/" + id, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) { showToast(json.message || "Errore", "error"); return; }
      showToast("Richiesta cancellata");
      // Reload permessi se la funzione esiste
      if (typeof loadPermesi === 'function') loadPermesi();
    } catch (err) { showToast("Errore server", "error"); }
  }

  // ── invia richiesta modifica turni ───────────────────────────────────────
  async function inviRichiestaTurni(e) {
    e.preventDefault();
    if (!turniDataDal || !turniDataAl) { showToast("Seleziona il periodo", "error"); return; }
    const giorniSelezionati = Object.entries(turniGiorniSelezionati).filter(([, selected]) => selected).map(([day, ]) => day);
    if (giorniSelezionati.length === 0) { showToast("Seleziona almeno un giorno", "error"); return; }
    if (!turniMotivo.trim()) { showToast("Inserisci il motivo (obbligatorio)", "error"); return; }
    // Verifica che tutti i giorni selezionati abbiano orari
    for (const day of giorniSelezionati) {
      if (!turniOrari[day]?.ingresso || !turniOrari[day]?.uscita) {
        showToast(`Inserisci orari per ${day}`, "error");
        return;
      }
    }
    setSavingTurni(true);
    try {
      const orariBody = {};
      giorniSelezionati.forEach(day => {
        orariBody[day] = { ingresso: turniOrari[day].ingresso, uscita: turniOrari[day].uscita };
      });
      const res = await fetch(API_URL + "/api/dipendente/richieste/modifica-turni", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          data_dal: turniDataDal,
          data_al: turniDataAl,
          giorni: giorniSelezionati,
          orari: orariBody,
          motivo: turniMotivo.trim()
        })
      });
      const json = await res.json();
      if (!json.success) {
        showToast(json.message || json.error || "Errore", "error");
        return;
      }
      showToast("Richiesta modifica turni inviata — in attesa di approvazione");
      setTurniDataDal(""); setTurniDataAl(""); setTurniGiorniSelezionati({lunedi: false, martedi: false, mercoledi: false, giovedi: false, venerdi: false, sabato: false, domenica: false}); setTurniOrari({}); setTurniMotivo(""); setShowTurniForm(false);
      // Reload richieste turni se la funzione esiste
      if (typeof loadRichiesteTurni === 'function') loadRichiesteTurni();
    } catch (err) { showToast("Errore server", "error"); }
    finally { setSavingTurni(false); }
  }

  // ── cancella richiesta modifica turni ────────────────────────────────────
  async function cancellaRichiestaTurni(id) {
    if (!confirm("Cancellare questa richiesta?")) return;
    try {
      const res  = await fetch(API_URL + "/api/dipendente/richieste/modifica-turni/" + id, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) { showToast(json.message || "Errore", "error"); return; }
      showToast("Richiesta cancellata");
      // Reload richieste turni se la funzione esiste
      if (typeof loadRichiesteTurni === 'function') loadRichiesteTurni();
    } catch (err) { showToast("Errore server", "error"); }
  }

  function logout() { localStorage.clear(); navigate("/"); }

  async function downloadMonthPDF(mese) {
    // Apre subito una finestra vuota (sincrono, dentro il click) così Safari non la
    // blocca come popup. Il PDF verrà caricato lì una volta pronto, invece che al
    // posto della pagina dell'app: su iPhone Safari apre spesso i PDF a schermo
    // intero sostituendo la pagina corrente, e tornare indietro da lì mostrava una
    // schermata bianca.
    const pdfWindow = window.open("", "_blank");
    try {
      const res = await fetch(API_URL + "/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ employee_ids: [employee.id], month: mese })
      });
      if (!res.ok) {
        if (pdfWindow) pdfWindow.close();
        showToast("Errore generazione PDF", "error");
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      if (pdfWindow) {
        pdfWindow.location.href = url;
      } else {
        const a    = document.createElement("a");
        a.href     = url;
        a.download = `Timbry_${employee.cognome}_${employee.nome}_${mese.replace(/\s+/g, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (pdfWindow) pdfWindow.close();
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
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-[#111113]/70 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-5 h-14 sm:h-16 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Timbry" className="h-7 sm:h-8 w-auto" />
            <span className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Timbry</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-5 py-5 sm:py-7 pb-28">
        <div className="mb-4 sm:mb-6 flex items-center gap-3 flex-wrap">
          <p className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Ciao, {employee.nome}</p>
          {employee.importo_orario != null && (() => {
            const stipendio = stats.ore_mese_corrente * employee.importo_orario;
            if (stipendio <= 0) return null;
            return (
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-xl">
                € {stipendio.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            );
          })()}
        </div>
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
        {tab === "presenze" && (() => {
          const todayStr = new Date().toISOString().split("T")[0];
          const ferieInCorso = [
            ...ferie.filter(f => f.stato === "approvata" && f.data_inizio <= todayStr && f.data_fine >= todayStr),
            ...pause.filter(p => p.data_inizio <= todayStr && p.data_fine >= todayStr)
          ].reduce((tot, f) => tot + Math.round((new Date(f.data_fine) - new Date(todayStr)) / 86400000) + 1, 0);
          const ferieProssime = [
            ...ferie.filter(f => f.stato === "approvata" && f.data_inizio > todayStr),
            ...pause.filter(p => p.data_inizio > todayStr)
          ].reduce((tot, f) => tot + Math.round((new Date(f.data_fine) - new Date(f.data_inizio)) / 86400000) + 1, 0);
          const statsList = [
            { icon: Clock,     label: "Ore questo mese",  value: `${stats.ore_mese_corrente}h` },
          ];
          if (data?.turni_attivi) {
            statsList.push({ icon: UserCheck, label: "Giorni assenti", value: stats.giorni_assenti });
            statsList.push({ icon: TrendingUp, label: "Ore straordinario", value: `${stats.ore_straordinario}h` });
          }
          return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {statsList.map((s) => {
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

        {/* ══════════ TAB: PRESENZE (storico) ══════════ */}
        {tab === "presenze" && (
          <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Storico presenze</h3>
            </div>
            {Object.keys(months).length === 0 ? (
              <p className="text-center py-12 text-sm text-zinc-400">Nessuna presenza registrata</p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {Object.entries(months).map(([mese, giorni]) => {
                  const oreM   = Number(giorni.reduce((s, d) => s + d.ore_totali, 0).toFixed(2));
                  const assM   = giorni.filter(d => d.assente).length;
                  const isOpen = openMonth === mese;
                  return (
                    <div key={mese}>
                      {/* HEADER MESE */}
                      <button
                        className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors text-left"
                        onClick={() => setOpenMonth(isOpen ? null : mese)}
                      >
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 capitalize">{mese}</span>
                        <div className="flex items-center gap-2.5">
                          {assM > 0 && <span className="text-xs text-red-400">{assM} ass.</span>}
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{oreM}h</span>
                          <button
                            onClick={e => { e.stopPropagation(); downloadMonthPDF(mese); }}
                            className="flex items-center gap-1 h-7 px-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[11px] font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                            title={`Scarica PDF ${mese}`}
                          >
                            <Download size={11} />
                            <span className="hidden sm:inline">PDF</span>
                          </button>
                          {isOpen ? <ChevronUp size={15} className="text-zinc-400" /> : <ChevronDown size={15} className="text-zinc-400" />}
                        </div>
                      </button>

                      {/* GIORNI */}
                      {isOpen && (
                        <div className="border-t border-zinc-100 dark:border-zinc-800">
                          {giorni.map(g => {
                            const { label, color } = statoBadge(g.stato, g.ritardo_minuti);
                            const giust = giustificazioni.find(j => j.data === g.giorno);
                            return (
                              <div key={g.giorno} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">

                                {/* ROW PIATTO */}
                                <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5">

                                  {/* DATA */}
                                  <span className="text-xs text-zinc-400 w-14 shrink-0 tabular-nums">
                                    {new Date(g.giorno).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" })}
                                  </span>

                                  {/* STATO */}
                                  <span className={`shrink-0 w-[72px] text-center px-2 py-0.5 rounded-md text-[11px] font-medium ${color}`}>{label}</span>

                                  {/* TIMBRATURE */}
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 flex-1 min-w-0">
                                    {g.coppie.length > 0 ? g.coppie.map((c, i) => (
                                      <div key={i} className="flex items-center gap-3">
                                        <div className="flex items-center gap-1">
                                          <span className="text-emerald-500 font-semibold text-xs">↑</span>
                                          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 tabular-nums">{c.entrata || "—"}</span>
                                          {c.entrata_id && (
                                            <button onClick={() => openModifyModal(c.entrata_id, g.giorno, c.entrata)}
                                              title="Richiedi modifica"
                                              className="ml-0.5 text-zinc-300 hover:text-blue-500 transition-colors">
                                              <Pencil size={11} />
                                            </button>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-red-400 font-semibold text-xs">↓</span>
                                          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 tabular-nums">{c.uscita || "—"}</span>
                                          {c.uscita && c.uscita_giorno_dopo && <span className="text-indigo-500 text-[10px] font-medium ml-0.5">+1</span>}
                                          {c.uscita_id && (
                                            <button onClick={() => openModifyModal(c.uscita_id, g.giorno, c.uscita_giorno_dopo ? null : c.uscita)}
                                              title="Richiedi modifica"
                                              className="ml-0.5 text-zinc-300 hover:text-blue-500 transition-colors">
                                              <Pencil size={11} />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )) : (
                                      <span className="text-xs text-zinc-400">—</span>
                                    )}
                                  </div>

                                  {/* ORE + GIUSTIFICA */}
                                  <div className="flex items-center gap-2 ml-auto shrink-0">
                                    {g.ore_totali > 0 && (
                                      <span className="text-xs text-zinc-400 tabular-nums">{g.ore_totali}h</span>
                                    )}
                                    {g.assente && !giust && (
                                      <button onClick={() => setShowJustForm(showJustForm === g.giorno ? null : g.giorno)}
                                        title="Giustifica assenza"
                                        className="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-300 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                                        <AlertCircle size={12} />
                                      </button>
                                    )}
                                    {giust && (
                                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium ${statoBadgeFerie(giust.stato).color}`}>
                                        {giust.stato === "rifiutata" ? "Giust. rifiutata" : giust.stato === "approvata" ? "Giustificata" : "Giust. in attesa"}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* FORM GIUSTIFICA (inline, solo se aperto) */}
                                {g.assente && !giust && showJustForm === g.giorno && (
                                  <div className="px-4 sm:px-6 pb-3 space-y-2">
                                    <textarea
                                      rows={2}
                                      placeholder="Motivo dell'assenza..."
                                      value={justMotivo}
                                      onChange={e => setJustMotivo(e.target.value)}
                                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none resize-none"
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={() => inviaGiustificazione(g.giorno)} disabled={savingJust}
                                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-xs font-medium disabled:opacity-50">
                                        <Send size={12} /> {savingJust ? "Invio..." : "Invia"}
                                      </button>
                                      <button onClick={() => { setShowJustForm(null); setJustMotivo(""); }}
                                        className="h-8 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs">
                                        Annulla
                                      </button>
                                    </div>
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
              <form onSubmit={inviaRichiestaFerie} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
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
            {/* SOTTOMENU RICHIESTE */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setRequestsSubTab("timbratura")}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                  requestsSubTab === "timbratura"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                Timbratura mancata
              </button>
              <button
                onClick={() => setRequestsSubTab("permessi")}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                  requestsSubTab === "permessi"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                Permessi
              </button>
              <button
                onClick={() => setRequestsSubTab("turni")}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                  requestsSubTab === "turni"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                Cambio turno
              </button>
            </div>

            {/* SEZIONE TIMBRATURA MANCATA */}
            {requestsSubTab === "timbratura" && (
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Richiedi timbratura mancata</h3>
              
              {!showMissingScanForm && (
                <button onClick={() => setShowMissingScanForm(true)}
                  className="flex items-center gap-1.5 sm:gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium mb-5 sm:mb-6">
                  <Clock size={14} className="sm:w-[15px] sm:h-[15px]" /> Nuova richiesta
                </button>
              )}

              {showMissingScanForm && (
                <form onSubmit={inviaMissingScan} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
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
            )}

            {/* SEZIONE PERMESSI DI USCITA/ENTRATA */}
            {requestsSubTab === "permessi" && (
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Richiedi permesso</h3>

              {!showPermesoForm && (
                <button onClick={() => setShowPermesoForm(true)}
                  className="flex items-center gap-1.5 sm:gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium mb-5 sm:mb-6">
                  <Clock size={14} className="sm:w-[15px] sm:h-[15px]" /> Nuova richiesta
                </button>
              )}

              {showPermesoForm && (
                <form onSubmit={inviPermesso} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Richiesta permesso</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    Richiedi un permesso di uscita o entrata anticipata/ritardata.
                  </p>

                  <div className="mb-4">
                    <p className="text-xs text-zinc-400 mb-2">Tipo di permesso</p>
                    <select value={permesoTipo} onChange={e => setPermesoTipo(e.target.value)}
                      className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm">
                      <option value="personale">Personale</option>
                      <option value="medico">Medico</option>
                      <option value="altro">Altro</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Data uscita</p>
                      <input type="date" value={permesoDataUscita} onChange={e => setPermesoDataUscita(e.target.value)}
                        className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Ora uscita</p>
                      <input type="time" value={permesoOraUscita} onChange={e => setPermesoOraUscita(e.target.value)}
                        className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Data rientro</p>
                      <input type="date" value={permesoDataEntrata} onChange={e => setPermesoDataEntrata(e.target.value)}
                        className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Ora rientro</p>
                      <input type="time" value={permesoOraEntrata} onChange={e => setPermesoOraEntrata(e.target.value)}
                        className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm" />
                    </div>
                  </div>

                  <textarea rows={2} placeholder="Motivo del permesso (obbligatorio)" value={permesoMotivo} onChange={e => setPermesoMotivo(e.target.value)}
                    className="w-full px-3 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none resize-none mb-4"
                    required />

                  <div className="flex gap-2">
                    <button type="submit" disabled={savingPermeso}
                      className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium disabled:opacity-50">
                      <Send size={14} /> {savingPermeso ? "Invio..." : "Invia richiesta"}
                    </button>
                    <button type="button" onClick={() => setShowPermesoForm(false)}
                      className="h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">
                      Annulla
                    </button>
                  </div>
                </form>
              )}

              {permesi.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-sm">Nessuna richiesta</div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {permesi.map(p => {
                    const { label, color } = statoBadgeFerie(p.stato);
                    return (
                      <div key={p.id} className="rounded-xl sm:rounded-2xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 px-4 sm:px-5 py-3 sm:py-4 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 xs:gap-0">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Clock size={14} className="text-zinc-400 shrink-0" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              {p.tipo} — {p.data_uscita} {p.ora_uscita && `alle ${p.ora_uscita}`}
                            </span>
                          </div>
                          {p.motivo && <p className="text-xs text-zinc-400 ml-5">{p.motivo}</p>}
                          <p className="text-xs text-zinc-400 mt-0.5 ml-5">
                            Richiesta il {fmt(p.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-5 xs:ml-0 shrink-0">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>
                          {p.stato === "in_attesa" && (
                            <button onClick={() => cancellaPermesso(p.id)} className="text-xs text-red-500 hover:text-red-700">
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
            )}

            {/* SEZIONE CAMBIO TURNO */}
            {requestsSubTab === "turni" && (
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Richiesta cambio turno</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                Puoi richiedere al titolare di modificare il tuo orario di lavoro per un periodo specifico.
              </p>

              {!shifts?.length && (
                <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 text-center">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Nessun turno assegnato — contatta il titolare.</p>
                  <p className="text-xs text-zinc-400 mt-1">Una volta assegnato un turno, potrai inviare richieste di modifica.</p>
                </div>
              )}

              {shifts?.length > 0 && !showTurniForm && (
                <button onClick={() => setShowTurniForm(true)}
                  className="flex items-center gap-1.5 sm:gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium mb-5 sm:mb-6">
                  <Clock size={14} className="sm:w-[15px] sm:h-[15px]" /> Nuova richiesta cambio turno
                </button>
              )}

              {shifts?.length > 0 && showTurniForm && (
                <form onSubmit={inviRichiestaTurni} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Richiesta cambio turno</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    Seleziona il periodo e indica i nuovi orari che desideri. Il titolare riceverà la richiesta e potrà approvarla o rifiutarla.
                  </p>

                  <div className="mb-4">
                    <p className="text-xs text-zinc-400 mb-2">Periodo (dal - al)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={turniDataDal} onChange={e => setTurniDataDal(e.target.value)}
                        placeholder="Dal" className="h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm" required />
                      <input type="date" value={turniDataAl} onChange={e => setTurniDataAl(e.target.value)}
                        placeholder="Al" className="h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none text-sm" required />
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-zinc-400 mb-2">Giorni della settimana</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries({lunedi: "Lunedì", martedi: "Martedì", mercoledi: "Mercoledì", giovedi: "Giovedì", venerdi: "Venerdì", sabato: "Sabato", domenica: "Domenica"}).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={turniGiorniSelezionati[key]} onChange={e => setTurniGiorniSelezionati({...turniGiorniSelezionati, [key]: e.target.checked})}
                            className="w-4 h-4 rounded border-zinc-300 accent-zinc-900 dark:accent-zinc-100" />
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs text-zinc-400 mb-3">Orari per i giorni selezionati</p>
                    {Object.entries(turniGiorniSelezionati).filter(([, selected]) => selected).map(([day, ]) => (
                      <div key={day} className="mb-3 pb-3 border-b border-zinc-200 dark:border-zinc-700 last:border-0">
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2 capitalize">{day}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="time" value={turniOrari[day]?.ingresso || ""} onChange={e => setTurniOrari({...turniOrari, [day]: {...turniOrari[day] || {}, ingresso: e.target.value}})}
                            placeholder="Ingresso" className="h-9 px-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none text-xs" />
                          <input type="time" value={turniOrari[day]?.uscita || ""} onChange={e => setTurniOrari({...turniOrari, [day]: {...turniOrari[day] || {}, uscita: e.target.value}})}
                            placeholder="Uscita" className="h-9 px-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none text-xs" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <textarea rows={2} placeholder="Motivo della richiesta (obbligatorio)" value={turniMotivo} onChange={e => setTurniMotivo(e.target.value)}
                    className="w-full px-3 py-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none resize-none mb-4"
                    required />

                  <div className="flex gap-2">
                    <button type="submit" disabled={savingTurni}
                      className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium disabled:opacity-50">
                      <Send size={14} /> {savingTurni ? "Invio..." : "Invia richiesta"}
                    </button>
                    <button type="button" onClick={() => setShowTurniForm(false)}
                      className="h-11 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">
                      Annulla
                    </button>
                  </div>
                </form>
              )}

              {richiesteTurni.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-sm">Nessuna richiesta</div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {richiesteTurni.map(r => {
                    const { label, color } = statoBadgeFerie(r.stato);
                    return (
                      <div key={r.id} className="rounded-xl sm:rounded-2xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 px-4 sm:px-5 py-3 sm:py-4 flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 xs:gap-0">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Clock size={14} className="text-zinc-400 shrink-0" />
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                              Dal {r.data_dal} al {r.data_al}
                            </span>
                          </div>
                          {r.motivo && <p className="text-xs text-zinc-400 ml-5">{r.motivo}</p>}
                          <p className="text-xs text-zinc-400 mt-0.5 ml-5">
                            Richiesta il {fmt(r.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ml-5 xs:ml-0 shrink-0">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${color}`}>{label}</span>
                          {r.stato === "in_attesa" && (
                            <button onClick={() => cancellaRichiestaTurni(r.id)} className="text-xs text-red-500 hover:text-red-700">
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
            )}

          </div>
        )}

        {/* ══════════ TAB: PROFILO ══════════ */}
        {tab === "profilo" && (
          <div className="space-y-4">

            {/* ── HUB ── */}
            {!profiloSub && (
              <>
                {/* Avatar + nome */}
                <div className="flex items-center gap-3 px-1 mb-1">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-black text-base font-semibold shrink-0">
                    {(employee.nome?.[0] || "").toUpperCase()}{(employee.cognome?.[0] || "").toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">{employee.nome} {employee.cognome}</p>
                    {employee.email && <p className="text-xs text-zinc-500 truncate">{employee.email}</p>}
                  </div>
                </div>

                {/* Impostazioni hub */}
                <SettingsGroup>
                  <SettingRow
                    onClick={() => { setEditNome(employee.nome || ''); setEditCognome(employee.cognome || ''); setEditEmail(employee.email || ''); setEditingProfile(false); setProfiloSub('profilo'); }}
                    icon={User}
                    iconBg="bg-blue-50 dark:bg-blue-900/20"
                    iconColor="text-blue-500"
                    title="Profilo"
                    subtitle="Nome, cognome e indirizzo email"
                  />
                  <SettingRow
                    onClick={() => setProfiloSub('sicurezza')}
                    icon={Shield}
                    iconBg="bg-green-50 dark:bg-green-900/20"
                    iconColor="text-green-500"
                    title="Sicurezza"
                    subtitle="Password e autenticazione a due fattori"
                  />
                  <SettingRow
                    onClick={() => {
                      setEditPromemoriaEntrata(employee.promemoria_entrata_minuti ?? null);
                      setEditPromemoriaUscita(employee.promemoria_uscita_minuti ?? null);
                      setProfiloSub('notifiche');
                    }}
                    icon={Bell}
                    iconBg="bg-amber-50 dark:bg-amber-900/20"
                    iconColor="text-amber-500"
                    title="Notifiche"
                    subtitle="Promemoria di entrata e uscita"
                  />
                </SettingsGroup>

                {/* Tema */}
                <SettingsGroup>
                  <ThemeRow />
                </SettingsGroup>

                {/* Logout */}
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 text-sm font-medium">
                  <LogOut size={15} /> Esci
                </button>

                {/* I MIEI TURNI */}
                <h3 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-1">I miei turni</h3>
                {shifts.length === 0 ? (
                  <div className="text-center py-10 text-zinc-400">
                    <Clock size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nessun turno assegnato</p>
                  </div>
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
              </>
            )}

            {/* ── SUB-VIEW: PROFILO ── */}
            {profiloSub === 'profilo' && (
              <>
                <button
                  onClick={() => { setProfiloSub(null); setEditingProfile(false); }}
                  className="inline-flex items-center gap-0.5 -ml-1 mb-1 text-sm font-medium text-blue-500">
                  <ChevronLeft size={18} /> Impostazioni
                </button>

                <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6">
                  {!editingProfile ? (
                    <>
                      <div className="flex items-center justify-between gap-3 mb-5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-black text-base font-semibold shrink-0">
                            {(employee.nome?.[0] || "").toUpperCase()}{(employee.cognome?.[0] || "").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">{employee.nome} {employee.cognome}</p>
                            {employee.email && <p className="text-xs text-zinc-500 truncate">{employee.email}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => setEditingProfile(true)}
                          className="shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 text-xs font-medium">
                          <Pencil size={13} /> Modifica
                        </button>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                          <span className="text-zinc-500">Nome</span>
                          <span className="text-zinc-900 dark:text-zinc-100 font-medium">{employee.nome || "—"}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                          <span className="text-zinc-500">Cognome</span>
                          <span className="text-zinc-900 dark:text-zinc-100 font-medium">{employee.cognome || "—"}</span>
                        </div>
                        <div className="flex justify-between py-2">
                          <span className="text-zinc-500">Email</span>
                          <span className="text-zinc-900 dark:text-zinc-100 font-medium truncate max-w-[60%] text-right">{employee.email || "—"}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Modifica profilo</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-zinc-400 mb-1">Nome *</p>
                          <input value={editNome} onChange={e => setEditNome(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                        </div>
                        <div>
                          <p className="text-xs text-zinc-400 mb-1">Cognome</p>
                          <input value={editCognome} onChange={e => setEditCognome(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Email</p>
                        <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Se modifichi nome o email, ti verranno inviate nuove credenziali e verrai disconnesso.
                      </p>
                      <div className="flex gap-2 pt-1">
                        <button onClick={saveProfile} disabled={savingProfile}
                          className="flex-1 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50">
                          {savingProfile ? "Salvataggio..." : "Salva"}
                        </button>
                        <button onClick={() => setEditingProfile(false)}
                          className="flex-1 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm font-medium">
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── SUB-VIEW: SICUREZZA ── */}
            {profiloSub === 'sicurezza' && (
              <>
                <button
                  onClick={() => { setProfiloSub(null); setShowDeleteAccount(false); setDeletePassword(''); }}
                  className="inline-flex items-center gap-0.5 -ml-1 mb-1 text-sm font-medium text-blue-500">
                  <ChevronLeft size={18} /> Impostazioni
                </button>

                {/* 2FA */}
                <SettingsGroup>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-indigo-50 dark:bg-indigo-900/20">
                      <Shield size={18} className="text-indigo-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Verifica in 2 passaggi</p>
                      <p className="text-xs text-zinc-500">Richiede un codice email ad ogni login</p>
                    </div>
                    <button
                      onClick={toggleTwoFa}
                      disabled={loadingTwoFa}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 disabled:opacity-50 shrink-0 ${twoFaEnabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${twoFaEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <SettingRow
                    onClick={() => setShowChangePassword(true)}
                    icon={Lock}
                    iconBg="bg-zinc-100 dark:bg-zinc-800"
                    iconColor="text-zinc-600 dark:text-zinc-300"
                    title="Cambia password"
                    subtitle="Aggiorna la tua password di accesso"
                  />
                </SettingsGroup>

                {/* ELIMINA ACCOUNT */}
                <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-red-200 dark:border-red-900/40 p-5 sm:p-6">
                  {!showDeleteAccount ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">Elimina account</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Rimuove l'accesso al portale</p>
                      </div>
                      <button onClick={() => setShowDeleteAccount(true)}
                        className="px-4 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium border border-red-200 dark:border-red-800">
                        Elimina
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">Conferma eliminazione account</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">Questa azione rimuove il tuo accesso al portale. I dati lavorativi restano archiviati dall'azienda.</p>
                      <div>
                        <p className="text-xs text-zinc-400 mb-1">Inserisci la tua password per confermare</p>
                        <input
                          type="password"
                          value={deletePassword}
                          onChange={e => setDeletePassword(e.target.value)}
                          placeholder="Password"
                          className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={deleteAccount} disabled={deletingAccount}
                          className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-medium disabled:opacity-50">
                          {deletingAccount ? "Eliminazione..." : "Conferma eliminazione"}
                        </button>
                        <button onClick={() => { setShowDeleteAccount(false); setDeletePassword(''); }}
                          className="flex-1 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm font-medium">
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── SUB-VIEW: NOTIFICHE ── */}
            {profiloSub === 'notifiche' && (
              <>
                <button
                  onClick={() => setProfiloSub(null)}
                  className="inline-flex items-center gap-0.5 -ml-1 mb-1 text-sm font-medium text-blue-500">
                  <ChevronLeft size={18} /> Impostazioni
                </button>

                <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6">
                  {!employee.turni_attivi ? (
                    <p className="text-sm text-zinc-500">
                      I promemoria di timbratura sono disponibili solo se hai un turno di lavoro assegnato.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Promemoria timbratura</p>
                      <p className="text-xs text-zinc-500 mb-2">Ricevi un'email se dimentichi di timbrare entrata o uscita.</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-zinc-400 mb-1">Entrata — minuti dopo</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editPromemoriaEntrata !== null}
                              onChange={e => setEditPromemoriaEntrata(e.target.checked ? 15 : null)}
                              className="rounded"
                            />
                            {editPromemoriaEntrata !== null && (
                              <input type="number" min="0" max="120" value={editPromemoriaEntrata}
                                onChange={e => setEditPromemoriaEntrata(parseInt(e.target.value) || 0)}
                                className="w-full h-9 px-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-400 mb-1">Uscita — minuti dopo</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={editPromemoriaUscita !== null}
                              onChange={e => setEditPromemoriaUscita(e.target.checked ? 15 : null)}
                              className="rounded"
                            />
                            {editPromemoriaUscita !== null && (
                              <input type="number" min="0" max="120" value={editPromemoriaUscita}
                                onChange={e => setEditPromemoriaUscita(parseInt(e.target.value) || 0)}
                                className="w-full h-9 px-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                            )}
                          </div>
                        </div>
                      </div>
                      <button onClick={savePromemoria} disabled={savingPromemoria}
                        className="w-full h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50">
                        {savingPromemoria ? "Salvataggio..." : "Salva"}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        )}

      </div>

      <DipendenteBottomNav active={tab} onSelect={setTab} />
      <PushPrompt />
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