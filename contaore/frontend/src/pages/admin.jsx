import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, Trash2, KeyRound,
  X, Copy, Check, Clock, ChevronDown, ChevronUp,
  Users, ToggleLeft, ToggleRight, Mail, RefreshCw, CheckCircle2, XCircle, Radio, Download
} from "lucide-react";
import { API_URL } from "../api";

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`
      fixed bottom-6 left-1/2 -translate-x-1/2 z-50
      flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium
      ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}
    `}>
      {type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {message}
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#161618] rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-sm w-full mx-4 shadow-xl">
        <p className="text-zinc-900 dark:text-zinc-100 font-medium mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 h-11 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          >
            Elimina
          </button>
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {

  const navigate = useNavigate();

  const [companies, setCompanies]           = useState([]);
  const [loading, setLoading]               = useState(true);

  const [showCreate, setShowCreate]         = useState(false);
  const [companyName, setCompanyName]       = useState("");
  const [username, setUsername]             = useState("");
  const [ownerEmail, setOwnerEmail]         = useState("");
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState("");

  const [resettingPassword, setResettingPassword] = useState(null); // userId
  const [resetLoading, setResetLoading]     = useState(false);
  const [resetResult, setResetResult]       = useState(null); // { id, nuova_password } quando email non inviata

  const [toast, setToast]                   = useState(null);
  const [confirm, setConfirm]               = useState(null); // { message, onConfirm }

  const [copiedId, setCopiedId]             = useState(null);
  const [expandedCompany, setExpandedCompany] = useState(null);

  const [showFasciaForm, setShowFasciaForm] = useState(null);
  const [fasciaOraInizio, setFasciaOraInizio] = useState("07:00");
  const [fasciaOraFine, setFasciaOraFine]   = useState("10:00");
  const [fasciaTipo, setFasciaTipo]         = useState("ENTRATA");
  const [fasciaNome, setFasciaNome]         = useState("");
  const [fasciaReaderId, setFasciaReaderId] = useState("");
  const [savingFascia, setSavingFascia]     = useState(false);
  const [companyDevices, setCompanyDevices] = useState({}); // companyId → devices[]

  const [togglingPortale, setTogglingPortale] = useState(null);

  const [otaRelease, setOtaRelease]       = useState(null);
  const [showOtaForm, setShowOtaForm]     = useState(false);
  const [otaVersion, setOtaVersion]       = useState("");
  const [otaUrl, setOtaUrl]               = useState("");
  const [otaAttivo, setOtaAttivo]         = useState(true);
  const [savingOta, setSavingOta]         = useState(false);

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.role !== "superadmin") { navigate("/dashboard"); return; }
    loadCompanies();
  }, []);

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
      console.log(err);
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
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({ company_name: companyName, username, email: ownerEmail })
      });
      const data = await response.json();
      if (!data.success) {
        if (data.error === "USERNAME_ALREADY_EXISTS") setError("Username già esistente");
        else if (data.error === "MISSING_FIELDS") setError("Compila tutti i campi obbligatori");
        else setError("Errore nella creazione");
        return;
      }
      setCompanyName(""); setUsername(""); setOwnerEmail("");
      setShowCreate(false);
      if (data.email_inviata) {
        showToast(`Azienda creata — credenziali inviate a ${ownerEmail}`);
      } else {
        showToast("Azienda creata. Attenzione: email non inviata (verifica config Resend)", "error");
      }
      loadCompanies();
    } catch (err) {
      console.log(err);
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
      console.log(err);
      showToast("Errore di connessione", "error");
    }
  }

  // Reset password: auto-genera e invia via email
  async function resetPassword(userId, userEmail) {
    setResetLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/users/" + userId + "/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({}) // password auto-generata dal backend
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
      console.log(err);
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
        prev.map(c =>
          c.id === companyId ? { ...c, portale_dipendenti: !attivoAttuale } : c
        )
      );
    } catch (err) {
      console.log(err);
      showToast("Errore di connessione", "error");
    } finally {
      setTogglingPortale(null);
    }
  }

  useEffect(() => { loadOta(); }, []);

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
      showToast(otaAttivo ? `OTA attivo: v${otaVersion} — i dispositivi si aggiorneranno al prossimo ping` : "OTA disattivato");
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
      console.log(err);
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
      console.log(err);
      showToast("Errore di connessione", "error");
    }
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10]">

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">ContaOre</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Pannello Superadmin</p>
          </div>
          <button onClick={logout} className="h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium">
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* TITLE + BUTTON */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Aziende</h2>
            <p className="text-zinc-500 mt-1">{companies.length} aziende registrate</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium"
          >
            <Plus size={16} /> Nuova azienda
          </button>
        </div>

        {/* FORM CREA AZIENDA */}
        {showCreate && (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Nuova azienda</h3>
                <p className="text-sm text-zinc-500 mt-1">La password viene generata automaticamente e inviata via email al titolare</p>
              </div>
              <button onClick={() => { setShowCreate(false); setError(""); }}>
                <X size={20} className="text-zinc-500" />
              </button>
            </div>
            <form onSubmit={createCompany} className="grid md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Nome azienda *"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="h-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none"
                required
              />
              <input
                type="text"
                placeholder="Username titolare *"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none"
                required
              />
              <div className="md:col-span-2 relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="email"
                  placeholder="Email titolare * (riceverà username e password)"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-2xl border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500 placeholder-zinc-400"
                  required
                />
              </div>
              {error && <p className="md:col-span-2 text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="md:col-span-2 h-12 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Mail size={16} />
                {saving ? "Creazione in corso..." : "Crea azienda e invia credenziali via email"}
              </button>
            </form>
          </div>
        )}

        {/* SEZIONE OTA */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Download size={18} /> Aggiornamento Firmware OTA
              </h3>
              <p className="text-xs text-zinc-500 mt-1">I dispositivi si aggiornano automaticamente al prossimo ping (max 1 minuto)</p>
            </div>
            <button onClick={() => setShowOtaForm(!showOtaForm)} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
              <Plus size={14} /> {showOtaForm ? "Chiudi" : "Configura"}
            </button>
          </div>

          {/* Stato attuale */}
          {otaRelease ? (
            <div className={`flex items-center justify-between rounded-2xl px-4 py-3 border ${otaRelease.attivo ? "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30" : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"}`}>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">v{otaRelease.version}</p>
                <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">{otaRelease.url}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${otaRelease.attivo ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                {otaRelease.attivo ? "ATTIVO" : "DISATTIVATO"}
              </span>
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-4 text-center">
              <p className="text-xs text-zinc-400">Nessun aggiornamento configurato — i dispositivi rimangono sulla versione attuale</p>
            </div>
          )}

          {/* Form configurazione */}
          {showOtaForm && (
            <form onSubmit={saveOta} className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Versione target (es. 2.4.0)</p>
                  <input type="text" value={otaVersion} onChange={e => setOtaVersion(e.target.value)} required placeholder="2.4.0"
                    className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                </div>
                <div className="flex items-end gap-2">
                  <button type="button" onClick={() => setOtaAttivo(!otaAttivo)}
                    className={`h-10 px-4 rounded-xl text-sm font-medium transition-all ${otaAttivo ? "bg-blue-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}>
                    {otaAttivo ? "Attivo" : "Disattivato"}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1">URL del file .bin (deve essere pubblicamente accessibile)</p>
                <input type="url" value={otaUrl} onChange={e => setOtaUrl(e.target.value)} required placeholder="https://esempio.com/firmware-v2.4.0.bin"
                  className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingOta}
                  className="flex-1 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50">
                  {savingOta ? "Salvataggio..." : "Salva e attiva OTA"}
                </button>
                <button type="button" onClick={() => setShowOtaForm(false)}
                  className="h-10 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">
                  Annulla
                </button>
              </div>
            </form>
          )}
        </div>

        {/* LISTA AZIENDE */}
        {loading ? (
          <div className="text-zinc-500 text-center py-20">Caricamento...</div>
        ) : companies.length === 0 ? (
          <div className="text-zinc-500 text-center py-20">Nessuna azienda creata</div>
        ) : (
          <div className="flex flex-col gap-5">
            {companies.map((company) => (
              <div key={company.id} className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] overflow-hidden">

                {/* HEADER CARD */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        <Building2 size={20} className="text-zinc-700 dark:text-zinc-200" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{company.nome}</h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Creata il {new Date(company.created_at).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setExpandedCompany(expandedCompany === company.id ? null : company.id)}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      >
                        {expandedCompany === company.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        {expandedCompany === company.id ? "Chiudi" : "Dettagli"}
                      </button>
                      <button onClick={() => askDeleteCompany(company.id, company.nome)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* COMPANY ID + PORTALE ROW */}
                  <div className="flex flex-col sm:flex-row gap-3">

                    <div className="flex-1 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
                      <div>
                        <p className="text-xs text-zinc-400 mb-0.5">Company ID</p>
                        <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-[220px]">{company.id}</p>
                      </div>
                      <button onClick={() => copyToClipboard(company.id, company.id)} className="ml-2 shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                        {copiedId === company.id ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 min-w-[220px]">
                      <div>
                        <p className="text-xs text-zinc-400 mb-0.5">Portale dipendenti</p>
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-zinc-400" />
                          {company.account_dipendenti > 0 ? (
                            <p className="text-xs text-zinc-500">{company.account_dipendenti} account</p>
                          ) : (
                            <p className="text-xs text-zinc-400">Nessun account</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => togglePortale(company.id, company.portale_dipendenti)}
                        disabled={togglingPortale === company.id}
                        className="ml-3 shrink-0 transition-opacity disabled:opacity-40"
                        title={company.portale_dipendenti ? "Disabilita portale" : "Abilita portale"}
                      >
                        {company.portale_dipendenti ? (
                          <ToggleRight size={28} className="text-green-500" />
                        ) : (
                          <ToggleLeft size={28} className="text-zinc-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {company.portale_dipendenti && (
                    <div className="mt-3 flex items-center gap-2 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl px-4 py-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      <p className="text-xs text-green-700 dark:text-green-400">
                        Portale attivo — aggiungendo un badge con email verrà creato automaticamente l'account dipendente
                      </p>
                    </div>
                  )}
                </div>

                {/* DETTAGLI ESPANDIBILI */}
                {expandedCompany === company.id && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 p-6 grid md:grid-cols-2 gap-6">

                    {/* ACCOUNT */}
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Account azienda</h4>
                      <div className="space-y-3">
                        {company.users.map((user) => (
                          <div key={user.id} className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-zinc-400 mb-0.5">Username</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{user.username}</p>
                                {user.email && (
                                  <p className="text-xs text-zinc-400 mt-0.5">{user.email}</p>
                                )}
                              </div>
                              <button
                                onClick={() => setResettingPassword(resettingPassword === user.id ? null : user.id)}
                                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              >
                                <RefreshCw size={14} /> Reset password
                              </button>
                            </div>

                            {/* Panel reset password */}
                            {resettingPassword === user.id && (
                              <div className="mt-4 p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                {resetResult?.id === user.id ? (
                                  <>
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                                      Email non inviata (Resend non configurato). Copia la password e condividila manualmente con il titolare.
                                    </p>
                                    <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 mb-3">
                                      <p className="flex-1 font-mono text-sm text-zinc-900 dark:text-zinc-100 select-all">{resetResult.nuova_password}</p>
                                      <button
                                        onClick={() => copyToClipboard(resetResult.nuova_password, `pwd_${user.id}`)}
                                        className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                      >
                                        {copiedId === `pwd_${user.id}` ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                                      </button>
                                    </div>
                                    <button
                                      onClick={() => { setResettingPassword(null); setResetResult(null); }}
                                      className="h-9 px-3 rounded-xl bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm"
                                    >
                                      Chiudi
                                    </button>
                                  </>
                                ) : user.email ? (
                                  <>
                                    <p className="text-xs text-zinc-500 mb-3">
                                      Verrà generata una nuova password casuale e inviata via email a <strong className="text-zinc-700 dark:text-zinc-300">{user.email}</strong>
                                    </p>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => resetPassword(user.id, user.email)}
                                        disabled={resetLoading}
                                        className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50"
                                      >
                                        <Mail size={13} />
                                        {resetLoading ? "Invio..." : "Genera e invia via email"}
                                      </button>
                                      <button
                                        onClick={() => setResettingPassword(null)}
                                        className="h-9 px-3 rounded-xl bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm"
                                      >
                                        Annulla
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-xs text-amber-600 dark:text-amber-400">
                                    Nessuna email associata a questo account. Impossibile inviare le credenziali.
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
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        >
                          <Plus size={13} /> Aggiungi
                        </button>
                      </div>

                      {showFasciaForm === company.id && (
                        <div className="mb-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <p className="text-xs text-zinc-400 mb-1">Dalle</p>
                              <input type="time" value={fasciaOraInizio} onChange={(e) => setFasciaOraInizio(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                            </div>
                            <div>
                              <p className="text-xs text-zinc-400 mb-1">Alle</p>
                              <input type="time" value={fasciaOraFine} onChange={(e) => setFasciaOraFine(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                            </div>
                          </div>
                          <div className="mb-3">
                            <p className="text-xs text-zinc-400 mb-1">Tipo</p>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setFasciaTipo("ENTRATA")}
                                className={`flex-1 h-10 rounded-xl text-sm font-medium transition-all ${fasciaTipo === "ENTRATA" ? "bg-green-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}>
                                ENTRATA
                              </button>
                              <button type="button" onClick={() => setFasciaTipo("USCITA")}
                                className={`flex-1 h-10 rounded-xl text-sm font-medium transition-all ${fasciaTipo === "USCITA" ? "bg-red-500 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"}`}>
                                USCITA
                              </button>
                            </div>
                          </div>
                          <div className="mb-3">
                            <p className="text-xs text-zinc-400 mb-1">Lettore (opzionale — lascia vuoto per tutti)</p>
                            <select
                              value={fasciaReaderId}
                              onChange={(e) => setFasciaReaderId(e.target.value)}
                              className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
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
                            <p className="text-xs text-zinc-400 mb-1">Nome fascia (opzionale)</p>
                            <input type="text" placeholder={`es. ${fasciaTipo === "ENTRATA" ? "Entrata mattina" : "Uscita pomeriggio"}`}
                              value={fasciaNome} onChange={(e) => setFasciaNome(e.target.value)}
                              className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => addFascia(company.id)} disabled={savingFascia}
                              className="flex-1 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50">
                              {savingFascia ? "Salvataggio..." : "Salva fascia"}
                            </button>
                            <button onClick={() => setShowFasciaForm(null)}
                              className="h-10 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">
                              Annulla
                            </button>
                          </div>
                        </div>
                      )}

                      {company.fasce && company.fasce.length > 0 ? (
                        <div className="space-y-2">
                          {company.fasce.map((fascia) => (
                            <div key={fascia.id} className="flex items-center justify-between rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Clock size={14} className="text-zinc-400 shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{fascia.nome}</p>
                                  <p className="text-xs text-zinc-400 mt-0.5">{fascia.ora_inizio.slice(0, 5)} — {fascia.ora_fine.slice(0, 5)}</p>
                                  {fascia.reader_id && (
                                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                                      Lettore: {fascia.reader_id}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${fascia.tipo === "ENTRATA" ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"}`}>
                                  {fascia.tipo}
                                </span>
                                <button onClick={() => askDeleteFascia(fascia.id)} className="text-zinc-400 hover:text-red-500">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-6 text-center">
                          <p className="text-xs text-zinc-400">Nessuna fascia configurata</p>
                          <p className="text-xs text-zinc-400 mt-1">Senza fasce la logica usa l'ultima timbratura</p>
                        </div>
                      )}
                    </div>

                    {/* LETTORI NFC */}
                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Lettori NFC</h4>
                        <span className="text-xs text-zinc-400">{company.devices?.length || 0} dispositivi</span>
                      </div>
                      {company.devices && company.devices.length > 0 ? (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {company.devices.map((device) => {
                            const lastPing = device.ultimo_ping ? new Date(device.ultimo_ping).getTime() : 0;
                            const online = Date.now() - lastPing < 120000;
                            return (
                              <div key={device.reader_id} className={`rounded-2xl border px-4 py-3 ${online ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800" : "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20"}`}>
                                {/* Riga titolo */}
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <Radio size={13} className={online ? "text-green-500 shrink-0" : "text-red-400 shrink-0"} />
                                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                    {device.nome || device.reader_id}
                                  </p>
                                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${online ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"}`}>
                                    {online ? "ONLINE" : "OFFLINE"}
                                  </span>
                                </div>
                                {/* Dettagli */}
                                {device.nome && (
                                  <p className="text-xs text-zinc-400 font-mono mb-1">{device.reader_id}</p>
                                )}
                                {device.sede && (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">📍 {device.sede}</p>
                                )}
                                {device.firmware_version && (
                                  <p className="text-xs text-zinc-400 mb-2">FW {device.firmware_version}</p>
                                )}
                                {/* Componenti */}
                                {(device.nfc_ok !== null && device.nfc_ok !== undefined) || (device.display_ok !== null && device.display_ok !== undefined) ? (
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {(device.nfc_ok !== null && device.nfc_ok !== undefined) && (
                                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium ${device.nfc_ok ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${device.nfc_ok ? "bg-green-500" : "bg-red-500"}`} />
                                        NFC {device.nfc_ok ? "OK" : "ERRORE"}
                                      </span>
                                    )}
                                    {(device.display_ok !== null && device.display_ok !== undefined) && (
                                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium ${device.display_ok ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${device.display_ok ? "bg-green-500" : "bg-red-500"}`} />
                                        Display {device.display_ok ? "OK" : "ERRORE"}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                      ESP OK
                                    </span>
                                  </div>
                                ) : online ? (
                                  <p className="text-xs text-zinc-400 italic">Componenti: FW non aggiornato</p>
                                ) : null}
                                {device.ultimo_ping && (
                                  <p className="text-xs text-zinc-400 mt-1.5">
                                    Ultimo ping: {new Date(device.ultimo_ping).toLocaleString("it-IT")}
                                  </p>
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
      </div>
    </div>
  );
}
