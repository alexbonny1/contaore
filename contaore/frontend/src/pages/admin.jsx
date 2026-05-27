import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, Trash2, KeyRound,
  X, Copy, Check, Clock, ChevronDown, ChevronUp,
  Users, ToggleLeft, ToggleRight
} from "lucide-react";
import { API_URL } from "../api";

export default function Admin() {

  const navigate = useNavigate();

  const [companies, setCompanies]           = useState([]);
  const [loading, setLoading]               = useState(true);

  const [showCreate, setShowCreate]         = useState(false);
  const [companyName, setCompanyName]       = useState("");
  const [username, setUsername]             = useState("");
  const [password, setPassword]             = useState("");
  const [ownerEmail, setOwnerEmail]         = useState("");
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState("");

  const [changingPassword, setChangingPassword] = useState(null);
  const [newPassword, setNewPassword]       = useState("");

  const [copiedId, setCopiedId]             = useState(null);
  const [expandedCompany, setExpandedCompany] = useState(null);

  const [showFasciaForm, setShowFasciaForm] = useState(null);
  const [fasciaOraInizio, setFasciaOraInizio] = useState("07:00");
  const [fasciaOraFine, setFasciaOraFine]   = useState("10:00");
  const [fasciaTipo, setFasciaTipo]         = useState("ENTRATA");
  const [fasciaNome, setFasciaNome]         = useState("");
  const [savingFascia, setSavingFascia]     = useState(false);

  // portale dipendenti
  const [togglingPortale, setTogglingPortale] = useState(null);

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
        body: JSON.stringify({ company_name: companyName, username, password, email: ownerEmail || undefined })
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.error === "USERNAME_ALREADY_EXISTS" ? "Username già esistente" : "Errore nella creazione");
        return;
      }
      setCompanyName(""); setUsername(""); setPassword(""); setOwnerEmail("");
      setShowCreate(false);
      loadCompanies();
    } catch (err) {
      console.log(err);
      setError("Errore di connessione");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCompany(id, nome) {
    if (!confirm(`Eliminare l'azienda "${nome}" e tutti i suoi dati?`)) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/companies/" + id, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      const data = await response.json();
      if (!data.success) { alert("Errore eliminazione"); return; }
      loadCompanies();
    } catch (err) {
      console.log(err);
      alert("Errore di connessione");
    }
  }

  async function changePassword(userId) {
    if (!newPassword) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/users/" + userId + "/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ password: newPassword })
      });
      const data = await response.json();
      if (!data.success) { alert("Errore aggiornamento password"); return; }
      setChangingPassword(null); setNewPassword("");
      alert("Password aggiornata");
    } catch (err) {
      console.log(err);
      alert("Errore di connessione");
    }
  }

  // ─── TOGGLE PORTALE DIPENDENTI ─────────────────────────────────────────────
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
      if (!data.success) { alert("Errore aggiornamento portale"); return; }
      // aggiorna localmente senza ricaricare tutto
      setCompanies(prev =>
        prev.map(c =>
          c.id === companyId
            ? { ...c, portale_dipendenti: !attivoAttuale }
            : c
        )
      );
    } catch (err) {
      console.log(err);
      alert("Errore di connessione");
    } finally {
      setTogglingPortale(null);
    }
  }

  async function addFascia(companyId) {
    setSavingFascia(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/companies/" + companyId + "/fasce", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ nome: fasciaNome || null, ora_inizio: fasciaOraInizio, ora_fine: fasciaOraFine, tipo: fasciaTipo })
      });
      const data = await response.json();
      if (!data.success) { alert("Errore salvataggio fascia"); return; }
      setShowFasciaForm(null); setFasciaNome(""); setFasciaOraInizio("07:00"); setFasciaOraFine("10:00"); setFasciaTipo("ENTRATA");
      loadCompanies();
    } catch (err) {
      console.log(err);
      alert("Errore di connessione");
    } finally {
      setSavingFascia(false);
    }
  }

  async function deleteFascia(fasciaId) {
    if (!confirm("Eliminare questa fascia oraria?")) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/admin/fasce/" + fasciaId, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      const data = await response.json();
      if (!data.success) { alert("Errore eliminazione fascia"); return; }
      loadCompanies();
    } catch (err) {
      console.log(err);
      alert("Errore di connessione");
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
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Nuova azienda</h3>
              <button onClick={() => { setShowCreate(false); setError(""); }}>
                <X size={20} className="text-zinc-500" />
              </button>
            </div>
            <form onSubmit={createCompany} className="grid md:grid-cols-2 gap-4">
              <input type="text" placeholder="Nome azienda" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                className="h-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none" required />
              <input type="email" placeholder="Email titolare (riceverà le credenziali)" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)}
                className="h-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none" />
              <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)}
                className="h-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none" required />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none" required />
              {error && <p className="md:col-span-2 text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={saving}
                className="md:col-span-2 h-12 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black font-medium disabled:opacity-50">
                {saving ? "Creazione..." : ownerEmail ? "Crea azienda e invia credenziali via email" : "Crea azienda"}
              </button>
            </form>
          </div>
        )}

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
                      <button onClick={() => deleteCompany(company.id, company.nome)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* COMPANY ID + PORTALE ROW */}
                  <div className="flex flex-col sm:flex-row gap-3">

                    {/* company id */}
                    <div className="flex-1 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3">
                      <div>
                        <p className="text-xs text-zinc-400 mb-0.5">Company ID</p>
                        <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-[220px]">{company.id}</p>
                      </div>
                      <button onClick={() => copyToClipboard(company.id, company.id)} className="ml-2 shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                        {copiedId === company.id ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                      </button>
                    </div>

                    {/* ── PORTALE DIPENDENTI TOGGLE ── */}
                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 min-w-[220px]">
                      <div>
                        <p className="text-xs text-zinc-400 mb-0.5">Portale dipendenti</p>
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-zinc-400" />
                          {company.account_dipendenti > 0 && (
                            <p className="text-xs text-zinc-500">
                              {company.account_dipendenti} account
                            </p>
                          )}
                          {company.account_dipendenti === 0 && (
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

                  {/* banner quando portale attivo */}
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
                              </div>
                              <button
                                onClick={() => { setChangingPassword(user.id); setNewPassword(""); }}
                                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              >
                                <KeyRound size={14} /> Reset password
                              </button>
                            </div>
                            {changingPassword === user.id && (
                              <div className="mt-3 flex gap-2">
                                <input type="password" placeholder="Nuova password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                  className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                                <button onClick={() => changePassword(user.id)} className="h-9 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium">Salva</button>
                                <button onClick={() => setChangingPassword(null)} className="h-9 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm">Annulla</button>
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
                        <button onClick={() => setShowFasciaForm(showFasciaForm === company.id ? null : company.id)}
                          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
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
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${fascia.tipo === "ENTRATA" ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"}`}>
                                  {fascia.tipo}
                                </span>
                                <button onClick={() => deleteFascia(fascia.id)} className="text-zinc-400 hover:text-red-500">
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