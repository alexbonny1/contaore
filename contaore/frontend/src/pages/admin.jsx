import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, Trash2,
  X, Copy, Check, Clock, ChevronDown, ChevronUp,
  Users, ToggleLeft, ToggleRight, Mail, RefreshCw, CheckCircle2, XCircle, Radio, Download,
  FileText, ExternalLink, Shield, Upload, RotateCcw, Sun, Moon, LogOut, Key
} from "lucide-react";
import { API_URL } from "../api";

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`
      fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] sm:w-auto
      flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium
      ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}
    `}>
      {type === "success" ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
      <span className="leading-snug">{message}</span>
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#161618] rounded-t-3xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 w-full sm:max-w-sm shadow-xl">
        <p className="text-zinc-900 dark:text-zinc-100 font-medium mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 h-12 rounded-2xl bg-red-500 text-white text-sm font-medium">
            Elimina
          </button>
          <button onClick={onCancel} className="flex-1 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium">
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

// Input class helper — 16px font su mobile previene auto-zoom iOS Safari
const inputCls = "w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[16px] sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500";

function formatCountdown(seconds) {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Admin() {

  const navigate = useNavigate();

  const [dark, setDark]                     = useState(false);
  const [companies, setCompanies]           = useState([]);
  const [loading, setLoading]               = useState(true);

  const [showCreate, setShowCreate]         = useState(false);
  const [companyName, setCompanyName]       = useState("");
  const [username, setUsername]             = useState("");
  const [ownerEmail, setOwnerEmail]         = useState("");
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState("");

  const [resettingPassword, setResettingPassword] = useState(null);
  const [resetLoading, setResetLoading]     = useState(false);
  const [resetResult, setResetResult]       = useState(null);

  const [toast, setToast]                   = useState(null);
  const [confirm, setConfirm]               = useState(null);

  const [copiedId, setCopiedId]             = useState(null);
  const [expandedCompany, setExpandedCompany] = useState(null);

  const [showFasciaForm, setShowFasciaForm] = useState(null);
  const [fasciaOraInizio, setFasciaOraInizio] = useState("07:00");
  const [fasciaOraFine, setFasciaOraFine]   = useState("10:00");
  const [fasciaTipo, setFasciaTipo]         = useState("ENTRATA");
  const [fasciaNome, setFasciaNome]         = useState("");
  const [fasciaReaderId, setFasciaReaderId] = useState("");
  const [savingFascia, setSavingFascia]     = useState(false);
  const [companyDevices, setCompanyDevices] = useState({});

  const [togglingPortale, setTogglingPortale] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [alertEmail, setAlertEmail]       = useState("");
  const [alertEmailSaved, setAlertEmailSaved] = useState("");
  const [alertAttivo, setAlertAttivo]     = useState(true);
  const [offlineMinuti, setOfflineMinuti] = useState(5);
  const [alertCompanies, setAlertCompanies] = useState([]);
  const [savingAlert, setSavingAlert]     = useState(false);

  const [otaRelease, setOtaRelease]       = useState(null);
  const [showOtaForm, setShowOtaForm]     = useState(false);
  const [otaVersion, setOtaVersion]       = useState("");
  const [otaUrl, setOtaUrl]               = useState("");
  const [otaAttivo, setOtaAttivo]         = useState(true);
  const [savingOta, setSavingOta]         = useState(false);
  const [otaPendingReaders, setOtaPendingReaders] = useState(new Set());

  const [customDocs, setCustomDocs]         = useState({});
  const [uploadingDoc, setUploadingDoc]     = useState(null);
  const [activeTab, setActiveTab]           = useState("aziende");

  const [newCredentials, setNewCredentials] = useState(null);
  const [credsCountdown, setCredsCountdown] = useState(null);
  const [credCopied, setCredCopied]         = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.role !== "superadmin") { navigate("/dashboard"); return; }
    loadCompanies();
    loadCustomDocs();
    const interval = setInterval(() => {
      refreshDevices();
      setNow(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!newCredentials) { setCredsCountdown(null); return; }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((newCredentials.expiresAt - Date.now()) / 1000));
      setCredsCountdown(remaining);
      if (remaining <= 0) setNewCredentials(null);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [newCredentials]);

  async function loadCustomDocs() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/admin/documenti", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.success) {
        const map = {};
        (data.files || []).forEach(f => { map[f.key] = f.url; });
        setCustomDocs(map);
      }
    } catch (_) {}
  }

  async function uploadDoc(key, file) {
    setUploadingDoc(key);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/admin/documenti/" + encodeURIComponent(key), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ base64, mimeType: file.type })
      });
      const data = await res.json();
      if (data.success) {
        setCustomDocs(prev => ({ ...prev, [key]: data.url }));
        showToast("Documento aggiornato");
      } else {
        showToast("Errore caricamento", "error");
      }
    } catch (_) {
      showToast("Errore caricamento", "error");
    } finally {
      setUploadingDoc(null);
    }
  }

  async function resetDoc(key) {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/admin/documenti/" + encodeURIComponent(key), {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.success) {
        setCustomDocs(prev => { const n = { ...prev }; delete n[key]; return n; });
        showToast("Template ripristinato");
      }
    } catch (_) {}
  }

  async function refreshDevices() {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/companies", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await response.json();
      if (data.success) {
        setCompanies(prev => prev.map(c => {
          const updated = (data.companies || []).find(u => u.id === c.id);
          return updated ? { ...c, devices: updated.devices } : c;
        }));
        setNow(Date.now());
      }
    } catch (_) {}
  }

  async function loadCompanies() {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/companies", {
        headers: { Authorization: "Bearer " + token }
      });
      const data = await response.json();
      if (data.success) setCompanies(data.companies || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createCompany(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ company_name: companyName, username, email: ownerEmail })
      });
      const data = await response.json();
      if (!data.success) {
        if (data.error === "USERNAME_ALREADY_EXISTS") setError("Username già esistente");
        else if (data.error === "MISSING_FIELDS") setError("Compila tutti i campi obbligatori");
        else setError("Errore nella creazione");
        return;
      }
      const savedEmail = ownerEmail;
      const savedUsername = username;
      setCompanyName(""); setUsername(""); setOwnerEmail("");
      setShowCreate(false);
      setNewCredentials({
        username: savedUsername,
        email: savedEmail,
        password: data.password_generata,
        expiresAt: Date.now() + 10 * 60 * 1000
      });
      if (data.email_inviata) {
        showToast(`Azienda creata — credenziali inviate a ${savedEmail}`);
      } else {
        showToast("Azienda creata. Email non inviata (verifica Resend)", "error");
      }
      loadCompanies();
    } catch (err) {
      console.error(err);
      setError("Errore di connessione");
    } finally {
      setSaving(false);
    }
  }

  function askDeleteCompany(id, nome) {
    setConfirm({
      message: `Eliminare l'azienda "${nome}" e tutti i suoi dati?`,
      onConfirm: () => { setConfirm(null); deleteCompany(id); }
    });
  }

  async function deleteCompany(id) {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/companies/" + id, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      const data = await response.json();
      if (!data.success) { showToast("Errore eliminazione", "error"); return; }
      showToast("Azienda eliminata");
      loadCompanies();
    } catch (err) {
      console.error(err);
      showToast("Errore di connessione", "error");
    }
  }

  async function resetPassword(userId, userEmail) {
    setResetLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/users/" + userId + "/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!data.success) { showToast("Errore reset password", "error"); return; }
      if (data.email_inviata) {
        setResettingPassword(null);
        setResetResult(null);
        showToast(`Nuova password inviata a ${userEmail}`);
      } else {
        setResetResult({ id: userId, nuova_password: data.nuova_password });
        showToast("Password aggiornata — email non inviata", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Errore di connessione", "error");
    } finally {
      setResetLoading(false);
    }
  }

  async function togglePortale(companyId, attivoAttuale) {
    setTogglingPortale(companyId);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        API_URL + "/api/admin/companies/" + companyId + "/portale",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ attivo: !attivoAttuale })
        }
      );
      const data = await response.json();
      if (!data.success) { showToast("Errore aggiornamento portale", "error"); return; }
      setCompanies(prev =>
        prev.map(c => c.id === companyId ? { ...c, portale_dipendenti: !attivoAttuale } : c)
      );
    } catch (err) {
      console.error(err);
      showToast("Errore di connessione", "error");
    } finally {
      setTogglingPortale(null);
    }
  }

  useEffect(() => { loadOta(); loadSettings(); }, []);

  async function loadOta() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/admin/ota", { headers: { Authorization: "Bearer " + token } });
      const d = await res.json();
      if (d.success) {
        setOtaRelease(d.release);
        if (d.release) { setOtaVersion(d.release.version); setOtaUrl(d.release.url); setOtaAttivo(d.release.attivo); }
      }
    } catch (_) {}
  }

  async function loadSettings() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/admin/settings", { headers: { Authorization: "Bearer " + token } });
      const d = await res.json();
      if (d.success && d.settings) {
        if (d.settings.alert_email) { setAlertEmail(d.settings.alert_email); setAlertEmailSaved(d.settings.alert_email); }
        if (d.settings.alert_attivo !== undefined && d.settings.alert_attivo !== null) setAlertAttivo(d.settings.alert_attivo);
        if (d.settings.offline_minuti) setOfflineMinuti(d.settings.offline_minuti);
        if (Array.isArray(d.settings.alert_companies)) setAlertCompanies(d.settings.alert_companies);
      }
    } catch (_) {}
  }

  function toggleAlertCompany(companyId) {
    setAlertCompanies(prev =>
      prev.includes(companyId) ? prev.filter(id => id !== companyId) : [...prev, companyId]
    );
  }

  async function saveAlertEmail(e) {
    e.preventDefault();
    setSavingAlert(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          alert_email:     alertEmail,
          alert_attivo:    alertAttivo,
          offline_minuti:  Number(offlineMinuti) || 5,
          alert_companies: alertCompanies
        })
      });
      const d = await res.json();
      if (!d.success) { showToast("Errore salvataggio", "error"); return; }
      setAlertEmailSaved(alertEmail);
      showToast(alertEmail && alertAttivo ? `Alert configurati → ${alertEmail}` : "Alert disattivati");
    } catch (_) { showToast("Errore di connessione", "error"); }
    finally { setSavingAlert(false); }
  }

  async function triggerDeviceOta(readerId) {
    setOtaPendingReaders(prev => new Set([...prev, readerId]));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/admin/devices/" + encodeURIComponent(readerId) + "/ota-pending", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ pending: true })
      });
      const d = await res.json();
      if (!d.success) { showToast("Errore invio comando OTA", "error"); return; }
      setCompanies(prev => prev.map(c => ({
        ...c,
        devices: (c.devices || []).map(dev =>
          dev.reader_id === readerId ? { ...dev, ota_pending: true } : dev
        )
      })));
      showToast(`OTA pianificato per ${readerId} — si aggiornerà al prossimo ping`);
    } catch (_) { showToast("Errore di connessione", "error"); }
    finally { setOtaPendingReaders(prev => { const s = new Set(prev); s.delete(readerId); return s; }); }
  }

  async function saveOta(e) {
    e.preventDefault();
    setSavingOta(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/admin/ota", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ version: otaVersion, url: otaUrl, attivo: otaAttivo })
      });
      const d = await res.json();
      if (!d.success) { showToast("Errore salvataggio OTA", "error"); return; }
      setOtaRelease(d.release);
      setShowOtaForm(false);
      showToast(otaAttivo ? `OTA attivo: v${otaVersion}` : "OTA disattivato");
    } catch (_) { showToast("Errore di connessione", "error"); }
    finally { setSavingOta(false); }
  }

  async function openFasciaForm(companyId) {
    setShowFasciaForm(showFasciaForm === companyId ? null : companyId);
    setFasciaReaderId("");
    if (!companyDevices[companyId]) {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(API_URL + "/api/admin/companies/" + companyId + "/devices", {
          headers: { Authorization: "Bearer " + token }
        });
        const d = await res.json();
        if (d.success) setCompanyDevices(prev => ({ ...prev, [companyId]: d.devices || [] }));
      } catch (_) {}
    }
  }

  async function addFascia(companyId) {
    setSavingFascia(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/companies/" + companyId + "/fasce", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          nome:       fasciaNome || null,
          ora_inizio: fasciaOraInizio,
          ora_fine:   fasciaOraFine,
          tipo:       fasciaTipo,
          reader_id:  fasciaReaderId || null
        })
      });
      const data = await response.json();
      if (!data.success) { showToast("Errore salvataggio fascia", "error"); return; }
      setShowFasciaForm(null);
      setFasciaNome(""); setFasciaOraInizio("07:00"); setFasciaOraFine("10:00");
      setFasciaTipo("ENTRATA"); setFasciaReaderId("");
      showToast("Fascia oraria aggiunta");
      loadCompanies();
    } catch (err) {
      console.error(err);
      showToast("Errore di connessione", "error");
    } finally {
      setSavingFascia(false);
    }
  }

  function askDeleteFascia(fasciaId) {
    setConfirm({
      message: "Eliminare questa fascia oraria?",
      onConfirm: () => { setConfirm(null); deleteFascia(fasciaId); }
    });
  }

  async function deleteFascia(fasciaId) {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/fasce/" + fasciaId, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      const data = await response.json();
      if (!data.success) { showToast("Errore eliminazione fascia", "error"); return; }
      showToast("Fascia eliminata");
      loadCompanies();
    } catch (err) {
      console.error(err);
      showToast("Errore di connessione", "error");
    }
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  useEffect(() => {
    if (dark) { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else       { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [dark]);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0f0f10]">

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-[#111113]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center shrink-0">
              <Shield size={14} className="text-white dark:text-black" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">ContaOre</span>
              <span className="hidden sm:inline ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Superadmin</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDark(d => !d)} className="flex items-center justify-center h-10 w-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium">
              <LogOut size={14} /> Esci
            </button>
          </div>
        </div>
      </header>

      {/* ── TAB BAR ── */}
      <div className="sticky top-14 z-40 bg-white/95 dark:bg-[#111113]/95 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 flex gap-1 py-2">
          {[
            { id: "aziende",   label: "Aziende",   icon: Building2,  count: companies.length },
            { id: "sistema",   label: "Sistema",    icon: Radio,      count: null },
            { id: "documenti", label: "Documenti",  icon: FileText,   count: null },
          ].map(({ id, label, icon: Icon, count }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 h-9 px-3 sm:px-4 rounded-xl text-sm font-medium transition-colors whitespace-nowrap
                ${activeTab === id
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
              <Icon size={14} />
              <span>{label}</span>
              {count !== null && (
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${activeTab === id ? "bg-white/20 text-white dark:bg-black/20 dark:text-black" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-7">

        {/* ══ TAB SISTEMA ══ */}
        {activeTab === "sistema" && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ─── ALERT EMAIL ─── */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <Mail size={18} className="text-zinc-500 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Alert lettori</h3>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">Notifiche se un lettore va offline o ha un componente guasto</p>
              </div>
            </div>
            <button type="button" onClick={() => setAlertAttivo(!alertAttivo)} className="ml-3 shrink-0">
              {alertAttivo
                ? <ToggleRight size={32} className="text-green-500" />
                : <ToggleLeft size={32} className="text-zinc-400" />}
            </button>
          </div>

          <form onSubmit={saveAlertEmail} className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-zinc-400 mb-1.5">Email destinatario avvisi</p>
              <input
                type="email"
                value={alertEmail}
                onChange={e => setAlertEmail(e.target.value)}
                placeholder="es. admin@timbry.it"
                className={inputCls}
              />
            </div>

            <div>
              <p className="text-xs text-zinc-400 mb-1.5">Avvisa se offline da più di (minuti)</p>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="1" max="1440"
                  value={offlineMinuti}
                  onChange={e => setOfflineMinuti(e.target.value)}
                  className="w-24 h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[16px] sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
                />
                <span className="text-xs text-zinc-400 leading-snug">minuti senza ping → avviso offline</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-zinc-400">Aziende da monitorare</p>
                <button type="button"
                  onClick={() => setAlertCompanies([])}
                  className={`text-xs font-medium ${alertCompanies.length === 0 ? "text-blue-500" : "text-zinc-400"}`}>
                  {alertCompanies.length === 0 ? "✓ Tutte" : "Tutte"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {companies.map(c => {
                  const active = alertCompanies.length === 0 || alertCompanies.includes(c.id);
                  return (
                    <button key={c.id} type="button"
                      onClick={() => toggleAlertCompany(c.id)}
                      className={`h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                      }`}>
                      {active && "✓ "}{c.nome}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1.5">
                {alertCompanies.length === 0 ? "Ricevi avvisi da tutte le aziende" : `Solo ${alertCompanies.length} azienda/e selezionata/e`}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2.5">
              <XCircle size={14} className="text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug">Guasto NFC / Display → avviso immediato al primo ping</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-400 leading-snug min-w-0">
                {alertEmailSaved && alertAttivo
                  ? <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />Attivi → {alertEmailSaved}</span>
                  : alertAttivo ? "Imposta un'email" : "Avvisi disattivati"}
              </p>
              <button type="submit" disabled={savingAlert}
                className="shrink-0 h-11 px-5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-40">
                {savingAlert ? "..." : "Salva"}
              </button>
            </div>
          </form>
        </div>

        {/* ─── SEZIONE OTA ─── */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-4 sm:p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Download size={16} className="shrink-0" /> Firmware OTA
              </h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Configura la release, poi seleziona i lettori da aggiornare</p>
            </div>
            <button onClick={() => setShowOtaForm(!showOtaForm)}
              className="ml-3 shrink-0 flex items-center gap-1 text-sm text-zinc-500 h-9 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <Plus size={14} /> {showOtaForm ? "Chiudi" : "Configura"}
            </button>
          </div>

          {otaRelease ? (
            <div className={`rounded-2xl px-4 py-3 border ${otaRelease.attivo ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30" : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">v{otaRelease.version}</p>
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">{otaRelease.url}</p>
                </div>
                <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${otaRelease.attivo ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                  {otaRelease.attivo ? "ATTIVO" : "OFF"}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-4 text-center">
              <p className="text-xs text-zinc-400">Nessun aggiornamento configurato</p>
            </div>
          )}

          {showOtaForm && (
            <form onSubmit={saveOta} className="mt-4 flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-xs text-zinc-400 mb-1.5">Versione (es. 2.4.0)</p>
                  <input type="text" value={otaVersion} onChange={e => setOtaVersion(e.target.value)} required placeholder="2.4.0"
                    className={inputCls} />
                </div>
                <div className="flex flex-col justify-end">
                  <button type="button" onClick={() => setOtaAttivo(!otaAttivo)}
                    className={`h-11 px-4 rounded-xl text-sm font-medium transition-all ${otaAttivo ? "bg-blue-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}>
                    {otaAttivo ? "Attivo" : "Off"}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1.5">URL file .bin (pubblicamente accessibile)</p>
                <input type="url" value={otaUrl} onChange={e => setOtaUrl(e.target.value)} required
                  placeholder="https://esempio.com/firmware.bin"
                  className={inputCls} />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingOta}
                  className="flex-1 h-11 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50">
                  {savingOta ? "Salvataggio..." : "Salva OTA"}
                </button>
                <button type="button" onClick={() => setShowOtaForm(false)}
                  className="h-11 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">
                  Annulla
                </button>
              </div>
            </form>
          )}
        </div>

        </div>}{/* fine tab sistema */}

        {/* ══ TAB DOCUMENTI ══ */}
        {activeTab === "documenti" && <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-4">
            <FileText size={16} className="text-zinc-500 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Documenti legali</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Modelli pronti — compila, stampa, fai firmare, archivia</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              {
                file: "informativa_privacy_dipendente.html",
                titolo: "Informativa privacy dipendente",
                sottotitolo: "Art. 13 GDPR — da consegnare ad ogni dipendente",
                tag: "GDPR",
                tagColor: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
              },
              {
                file: "comunicazione_dipendenti_attivazione.html",
                titolo: "Comunicazione attivazione sistema ai dipendenti",
                sottotitolo: "Art. 4 co. 3 L. 300/1970 — da consegnare a ogni dipendente prima dell'attivazione",
                tag: "OBBLIGATORIO",
                tagColor: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
              },
              {
                file: "accordo_sindacale_art4.html",
                titolo: "Accordo sindacale — sistema rilevazione presenze",
                sottotitolo: "Art. 4 L. 300/1970 — da firmare con RSA/RSU prima dell'attivazione",
                tag: "OBBLIGATORIO",
                tagColor: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
              },
              {
                file: "comunicazione_inl.html",
                titolo: "Istanza autorizzazione INL",
                sottotitolo: "Art. 4 co. 1 L. 300/1970 — alternativa se non ci sono RSA/RSU",
                tag: "SE NO SINDACATO",
                tagColor: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
              },
              {
                file: "ricevuta_consegna_badge.html",
                titolo: "Ricevuta consegna badge NFC",
                sottotitolo: "Con regolamento d'uso — da far firmare ad ogni dipendente",
                tag: "PER DIPENDENTE",
                tagColor: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
              },
              {
                file: "registro_attivita_trattamento.html",
                titolo: "Registro attività di trattamento",
                sottotitolo: "Art. 30 GDPR — registro interno da tenere aggiornato",
                tag: "GDPR",
                tagColor: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
              },
              {
                file: "nomina_incaricati_trattamento.html",
                titolo: "Nomina incaricati al trattamento",
                sottotitolo: "Per HR e responsabili che accedono ai dati di presenza",
                tag: "GDPR",
                tagColor: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
              },
              {
                file: "accordo_responsabile_trattamento_art28.html",
                titolo: "Accordo Responsabile del Trattamento",
                sottotitolo: "Art. 28 GDPR — tra azienda cliente (Titolare) e ContaOre (Responsabile)",
                tag: "GDPR",
                tagColor: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
              },
              {
                file: "dichiarazione_conformita_ce.html",
                titolo: "Dichiarazione di Conformità UE — Lettore NFC",
                sottotitolo: "Direttiva RED 2014/53/UE — da firmare per ogni modello di dispositivo",
                tag: "DISPOSITIVO",
                tagColor: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
              },
              {
                file: "scheda_tecnica_dispositivo.html",
                titolo: "Scheda tecnica dispositivo",
                sottotitolo: "ContaOre-NFC-R1 — da allegare all'istanza INL e al contratto cliente",
                tag: "DISPOSITIVO",
                tagColor: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
              },
              {
                file: "verbale_installazione_collaudo.html",
                titolo: "Verbale di installazione e collaudo",
                sottotitolo: "Da firmare sul posto con il cliente ad ogni installazione",
                tag: "DISPOSITIVO",
                tagColor: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
              },
              {
                file: "garanzia_commerciale.html",
                titolo: "Garanzia commerciale dispositivo",
                sottotitolo: "12 mesi — da consegnare al cliente con il dispositivo",
                tag: "DISPOSITIVO",
                tagColor: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
              },
              {
                file: "etichetta_ce_dispositivo.html",
                titolo: "Etichetta CE dispositivo",
                sottotitolo: "80×50 mm (retro dispositivo) + A7 packaging — RED 2014/53/UE",
                tag: "DISPOSITIVO",
                tagColor: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
              },
              {
                file: "guida_documenti.html",
                titolo: "Guida ai documenti legali",
                sottotitolo: "Spiega a cosa serve ogni documento, quando usarlo e come compilarlo",
                tag: "GUIDA",
                tagColor: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
              },
            ].map((doc) => {
              const customUrl = customDocs[doc.file];
              const isUploading = uploadingDoc === doc.file;
              return (
                <div key={doc.file} className="flex flex-col rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 gap-2.5">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${doc.tagColor}`}>{doc.tag}</span>
                        {customUrl && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">✓ Custom</span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-snug">{doc.titolo}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{doc.sottotitolo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={customUrl || `/docs/${doc.file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 h-10 px-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-xs font-medium"
                    >
                      <ExternalLink size={12} /> Apri
                    </a>
                    <label className={`flex items-center gap-1.5 h-10 px-3 rounded-xl text-xs font-medium cursor-pointer transition-colors ${isUploading ? "opacity-50 pointer-events-none bg-zinc-200 dark:bg-zinc-700 text-zinc-400" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"}`}>
                      <Upload size={12} /> {isUploading ? "..." : "Sostituisci"}
                      <input type="file" accept=".pdf,.html" className="hidden"
                        onChange={e => { if (e.target.files[0]) uploadDoc(doc.file, e.target.files[0]); e.target.value = ""; }} />
                    </label>
                    {customUrl && (
                      <button onClick={() => resetDoc(doc.file)}
                        className="flex items-center gap-1.5 h-10 px-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors">
                        <RotateCcw size={12} /> Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-zinc-400 mt-3 leading-relaxed">
            Su iPhone: Apri → tocca il quadrato con freccia in alto → Stampa → Salva PDF
          </p>
        </div>}{/* fine tab documenti */}

        {/* ══ TAB AZIENDE ══ */}
        {activeTab === "aziende" && <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Aziende</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{companies.length} {companies.length === 1 ? "registrata" : "registrate"}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 h-11 px-4 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium"
          >
            <Plus size={15} /> Nuova
          </button>
        </div>

        {/* FORM CREA AZIENDA */}
        {showCreate && (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-4 sm:p-6 mb-4">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Nuova azienda</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">La password viene generata automaticamente e inviata via email al titolare</p>
              </div>
              <button onClick={() => { setShowCreate(false); setError(""); }} className="ml-3 shrink-0 p-1">
                <X size={20} className="text-zinc-500" />
              </button>
            </div>
            <form onSubmit={createCompany} className="flex flex-col gap-3">
              <input type="text" placeholder="Nome azienda *" value={companyName}
                onChange={(e) => setCompanyName(e.target.value)} className={inputCls} required />
              <input type="text" placeholder="Username titolare *" value={username}
                onChange={(e) => setUsername(e.target.value)} className={inputCls} required />
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input type="email" placeholder="Email titolare * (riceverà le credenziali)" value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-[16px] sm:text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500 placeholder-zinc-400"
                  required />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={saving}
                className="h-12 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                <Mail size={16} />
                {saving ? "Creazione in corso..." : "Crea e invia credenziali"}
              </button>
            </form>
          </div>
        )}

        {/* PANNELLO CREDENZIALI APPENA CREATE */}
        {newCredentials && (
          <div className="rounded-3xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 p-4 sm:p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Credenziali create</h3>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                    <Clock size={11} /> Visibili ancora {formatCountdown(credsCountdown)}
                  </p>
                </div>
              </div>
              <button onClick={() => setNewCredentials(null)} className="p-1 text-amber-700 dark:text-amber-400">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { label: "Username", value: newCredentials.username, key: "username" },
                { label: "Password", value: newCredentials.password, key: "password" }
              ].map(({ label, value, key }) => (
                <div key={key} className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-900/40 rounded-xl px-4 py-2.5 border border-amber-100 dark:border-amber-800/30">
                  <div className="min-w-0">
                    <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium uppercase tracking-wide">{label}</p>
                    <p className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{value}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(value);
                      setCredCopied(key);
                      setTimeout(() => setCredCopied(null), 2000);
                    }}
                    className="shrink-0 p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/30 transition"
                  >
                    {credCopied === key ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-700/60 dark:text-amber-500/60 mt-3">
              Credenziali inviate via email a {newCredentials.email}
            </p>
          </div>
        )}

        {/* ─── LISTA AZIENDE ─── */}
        {loading ? (
          <div className="text-zinc-500 text-center py-16">Caricamento...</div>
        ) : companies.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] py-16 text-center">
            <Building2 size={32} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">Nessuna azienda creata</p>
            <p className="text-xs text-zinc-400 mt-1">Usa il pulsante "Nuova azienda" per iniziare</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {companies.map((company) => (
              <div key={company.id} className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] overflow-hidden">

                {/* HEADER CARD */}
                <div className="p-4 sm:p-6">

                  {/* Nome + azioni */}
                  <div className="flex items-start justify-between mb-4 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        <Building2 size={18} className="text-zinc-700 dark:text-zinc-200" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">{company.nome}</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {new Date(company.created_at).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}
                        className="flex items-center gap-1.5 h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-300"
                      >
                        {expandedCompany === company.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {expandedCompany === company.id ? "Chiudi" : "Dettagli"}
                      </button>
                      <button onClick={() => askDeleteCompany(company.id, company.nome)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Company ID + Portale */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-400 mb-0.5">Company ID</p>
                        <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate">{company.id}</p>
                      </div>
                      <button onClick={() => copyToClipboard(company.id, company.id)}
                        className="ml-3 shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {copiedId === company.id ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
                      <div>
                        <p className="text-xs text-zinc-400 mb-0.5">Portale dipendenti</p>
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-zinc-400" />
                          <p className="text-xs text-zinc-500">
                            {company.account_dipendenti > 0 ? `${company.account_dipendenti} account` : "Nessun account"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => togglePortale(company.id, company.portale_dipendenti)}
                        disabled={togglingPortale === company.id}
                        className="ml-3 shrink-0 disabled:opacity-40"
                      >
                        {company.portale_dipendenti
                          ? <ToggleRight size={32} className="text-green-500" />
                          : <ToggleLeft size={32} className="text-zinc-400" />}
                      </button>
                    </div>
                  </div>

                  {company.portale_dipendenti && (
                    <div className="mt-2 flex items-start gap-2 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl px-4 py-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1 shrink-0" />
                      <p className="text-xs text-green-700 dark:text-green-400 leading-relaxed">
                        Portale attivo — badge con email crea automaticamente l'account dipendente
                      </p>
                    </div>
                  )}
                </div>

                {/* DETTAGLI ESPANDIBILI */}
                {expandedCompany === company.id && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 flex flex-col gap-5">

                    {/* ACCOUNT */}
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Account azienda</h4>
                      <div className="flex flex-col gap-3">
                        {company.users.map((user) => (
                          <div key={user.id} className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs text-zinc-400 mb-0.5">Username</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{user.username}</p>
                                {user.email && <p className="text-xs text-zinc-400 mt-0.5 truncate">{user.email}</p>}
                              </div>
                              <button
                                onClick={() => setResettingPassword(resettingPassword === user.id ? null : user.id)}
                                className="shrink-0 flex items-center gap-1.5 h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-500 dark:text-zinc-400"
                              >
                                <RefreshCw size={13} /> Reset
                              </button>
                            </div>

                            {resettingPassword === user.id && (
                              <div className="mt-3 p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                {resetResult?.id === user.id ? (
                                  <>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 leading-relaxed">
                                      Email non inviata (Resend non configurato). Copia e condividi manualmente.
                                    </p>
                                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 mb-3">
                                      <p className="flex-1 font-mono text-sm text-zinc-900 dark:text-zinc-100 select-all min-w-0 truncate">{resetResult.nuova_password}</p>
                                      <button onClick={() => copyToClipboard(resetResult.nuova_password, `pwd_${user.id}`)}
                                        className="shrink-0 w-8 h-8 flex items-center justify-center">
                                        {copiedId === `pwd_${user.id}` ? <Check size={15} className="text-green-500" /> : <Copy size={15} className="text-zinc-400" />}
                                      </button>
                                    </div>
                                    <button onClick={() => { setResettingPassword(null); setResetResult(null); }}
                                      className="h-10 px-4 rounded-xl bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm">
                                      Chiudi
                                    </button>
                                  </>
                                ) : user.email ? (
                                  <>
                                    <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                                      Nuova password casuale inviata a <strong className="text-zinc-700 dark:text-zinc-300">{user.email}</strong>
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <button
                                        onClick={() => resetPassword(user.id, user.email)}
                                        disabled={resetLoading}
                                        className="flex items-center justify-center gap-1.5 h-11 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50"
                                      >
                                        <Mail size={13} />
                                        {resetLoading ? "Invio..." : "Genera e invia email"}
                                      </button>
                                      <button onClick={() => setResettingPassword(null)}
                                        className="h-11 px-4 rounded-xl bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm">
                                        Annulla
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                                    Nessuna email associata. Impossibile inviare le credenziali.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* FASCE ORARIE */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Fasce orarie</h4>
                        <button
                          onClick={() => openFasciaForm(company.id)}
                          className="flex items-center gap-1 h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-500 dark:text-zinc-400"
                        >
                          <Plus size={13} /> Aggiungi
                        </button>
                      </div>

                      {showFasciaForm === company.id && (
                        <div className="mb-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <p className="text-xs text-zinc-400 mb-1.5">Dalle</p>
                              <input type="time" value={fasciaOraInizio} onChange={(e) => setFasciaOraInizio(e.target.value)}
                                className={inputCls} />
                            </div>
                            <div>
                              <p className="text-xs text-zinc-400 mb-1.5">Alle</p>
                              <input type="time" value={fasciaOraFine} onChange={(e) => setFasciaOraFine(e.target.value)}
                                className={inputCls} />
                            </div>
                          </div>
                          <div className="mb-3">
                            <p className="text-xs text-zinc-400 mb-1.5">Tipo</p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setFasciaTipo("ENTRATA")}
                                className={`flex-1 h-11 rounded-xl text-sm font-medium ${fasciaTipo === "ENTRATA" ? "bg-green-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}>
                                ENTRATA
                              </button>
                              <button type="button" onClick={() => setFasciaTipo("USCITA")}
                                className={`flex-1 h-11 rounded-xl text-sm font-medium ${fasciaTipo === "USCITA" ? "bg-red-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}>
                                USCITA
                              </button>
                            </div>
                          </div>
                          <div className="mb-3">
                            <p className="text-xs text-zinc-400 mb-1.5">Lettore (vuoto = tutti)</p>
                            <select
                              value={fasciaReaderId}
                              onChange={(e) => setFasciaReaderId(e.target.value)}
                              className={inputCls}
                            >
                              <option value="">Tutti i lettori</option>
                              {(companyDevices[company.id] || []).map(d => (
                                <option key={d.reader_id} value={d.reader_id}>
                                  {d.nome || d.reader_id}{d.sede ? ` — ${d.sede}` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="mb-3">
                            <p className="text-xs text-zinc-400 mb-1.5">Nome fascia (opzionale)</p>
                            <input type="text" placeholder={fasciaTipo === "ENTRATA" ? "es. Entrata mattina" : "es. Uscita pomeriggio"}
                              value={fasciaNome} onChange={(e) => setFasciaNome(e.target.value)}
                              className={inputCls} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => addFascia(company.id)} disabled={savingFascia}
                              className="flex-1 h-11 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50">
                              {savingFascia ? "Salvataggio..." : "Salva fascia"}
                            </button>
                            <button onClick={() => setShowFasciaForm(null)}
                              className="h-11 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">
                              Annulla
                            </button>
                          </div>
                        </div>
                      )}

                      {company.fasce && company.fasce.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {company.fasce.map((fascia) => (
                            <div key={fascia.id} className="flex items-center justify-between rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <Clock size={14} className="text-zinc-400 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{fascia.nome}</p>
                                  <p className="text-xs text-zinc-400 mt-0.5">{fascia.ora_inizio.slice(0, 5)} — {fascia.ora_fine.slice(0, 5)}</p>
                                  {fascia.reader_id && (
                                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5 truncate">Lettore: {fascia.reader_id}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${fascia.tipo === "ENTRATA" ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"}`}>
                                  {fascia.tipo}
                                </span>
                                <button onClick={() => askDeleteFascia(fascia.id)}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 text-red-400">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-6 text-center">
                          <p className="text-xs text-zinc-400">Nessuna fascia configurata</p>
                          <p className="text-xs text-zinc-400 mt-1">Senza fasce usa l'ultima timbratura</p>
                        </div>
                      )}
                    </div>

                    {/* LETTORI NFC */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Lettori NFC</h4>
                        <span className="text-xs text-zinc-400">{company.devices?.length || 0} dispositivi</span>
                      </div>
                      {company.devices && company.devices.length > 0 ? (
                        <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {company.devices.map((device) => {
                            const lastPing = device.ultimo_ping ? new Date(device.ultimo_ping).getTime() : 0;
                            const online = now - lastPing < 120000;
                            return (
                              <div key={device.reader_id} className={`rounded-2xl border px-4 py-3 ${online ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" : "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20"}`}>
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <Radio size={13} className={online ? "text-green-500 shrink-0" : "text-red-400 shrink-0"} />
                                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate flex-1">
                                    {device.nome || device.reader_id}
                                  </p>
                                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${online ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"}`}>
                                    {online ? "ONLINE" : "OFFLINE"}
                                  </span>
                                </div>
                                {device.nome && (
                                  <p className="text-xs text-zinc-400 font-mono mb-1 truncate">{device.reader_id}</p>
                                )}
                                {device.sede && (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">📍 {device.sede}</p>
                                )}
                                {device.firmware_version && (
                                  <p className="text-xs text-zinc-400 mb-1">FW {device.firmware_version}</p>
                                )}
                                {((device.nfc_ok !== null && device.nfc_ok !== undefined) || (device.display_ok !== null && device.display_ok !== undefined)) ? (
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {(device.nfc_ok !== null && device.nfc_ok !== undefined) && (
                                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium ${device.nfc_ok ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${device.nfc_ok ? "bg-green-500" : "bg-red-500"}`} />
                                        NFC {device.nfc_ok ? "OK" : "ERR"}
                                      </span>
                                    )}
                                    {(device.display_ok !== null && device.display_ok !== undefined) && (
                                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium ${device.display_ok ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${device.display_ok ? "bg-green-500" : "bg-red-500"}`} />
                                        Display {device.display_ok ? "OK" : "ERR"}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> ESP OK
                                    </span>
                                  </div>
                                ) : online ? (
                                  <p className="text-xs text-zinc-400 italic">FW non aggiornato</p>
                                ) : null}
                                {device.ultimo_ping && (
                                  <p className="text-xs text-zinc-400 mt-1.5">
                                    Ping: {new Date(device.ultimo_ping).toLocaleString("it-IT")}
                                  </p>
                                )}
                                {device.ota_pending && (
                                  <div className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                                    <Download size={11} className="text-amber-500 shrink-0" />
                                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">OTA in attesa — prossimo ping</span>
                                  </div>
                                )}
                                {otaRelease?.attivo && !device.ota_pending && (
                                  <button
                                    onClick={() => triggerDeviceOta(device.reader_id)}
                                    disabled={otaPendingReaders.has(device.reader_id)}
                                    className="mt-2 w-full flex items-center justify-center gap-1.5 h-9 rounded-xl bg-blue-500 text-white text-[11px] font-medium disabled:opacity-50"
                                  >
                                    <Download size={11} />
                                    {otaPendingReaders.has(device.reader_id) ? "..." : `Aggiorna → v${otaRelease.version}`}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-6 text-center">
                          <p className="text-xs text-zinc-400">Nessun lettore registrato</p>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>}{/* fine tab aziende */}

      </div>
    </div>
  );
}
