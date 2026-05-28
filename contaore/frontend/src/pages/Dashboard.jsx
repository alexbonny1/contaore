import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard, Radio, Sun, Moon,
  CheckCircle, XCircle, Clock3, FileText, Calendar,
  AlertCircle, Clock, ChevronDown, ChevronUp
} from "lucide-react";
import { API_URL } from "../api";
import ChangePasswordModal from "../components/ChangePasswordModal";

function statoBadge(stato) {
  switch (stato) {
    case 'in_attesa':  return { label: 'In attesa', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' }
    case 'approvata':  return { label: 'Approvata', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' }
    case 'rifiutata':  return { label: 'Rifiutata', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' }
    default: return { label: stato, color: 'bg-zinc-100 text-zinc-700' }
  }
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [dark, setDark] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // richieste pendenti
  const [richieste, setRichieste] = useState(null);
  const [richiesteLoading, setRichiesteLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [richiesteTab, setRichiesteTab] = useState('all');

  /* THEME */
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  useEffect(() => {
    if (dark) { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [dark]);

  /* LOAD */
  useEffect(() => {
    loadDashboard();
    loadRichieste();
    const i1 = setInterval(loadDashboard, 5000);
    const i2 = setInterval(loadRichieste, 15000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/api/employees", { headers: { Authorization: "Bearer " + token } });
      const data = await response.json();
      if (data.success) setEmployees(data.employees || []);
    } catch (err) { console.log(err); }
    finally { setLoading(false); }
  }

  async function loadRichieste() {
    try {
      setRichiesteLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/requests/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setRichieste(data);
    } catch (err) { console.log(err); }
    finally { setRichiesteLoading(false); }
  }

  async function approveRequest(type, id) {
    try {
      setActionLoading(prev => ({ ...prev, [id]: true }));
      const token = localStorage.getItem('token');
      let endpoint = '';
      if (type === 'ferie') endpoint = `/api/ferie/${id}/approva`;
      else if (type === 'giustificazioni') endpoint = `/api/giustificazioni/${id}/approva`;
      else if (type === 'timbratura') endpoint = `/api/requests/missing-scans/${id}/approva`;
      const res = await fetch(`${API_URL}${endpoint}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) { showToast('Richiesta approvata ✓', 'success'); loadRichieste(); }
      else showToast('Errore approvazione', 'error');
    } catch (err) { showToast('Errore', 'error'); }
    finally { setActionLoading(prev => ({ ...prev, [id]: false })); }
  }

  async function rejectRequest(type, id) {
    try {
      setActionLoading(prev => ({ ...prev, [id]: true }));
      const token = localStorage.getItem('token');
      let endpoint = '';
      if (type === 'ferie') endpoint = `/api/ferie/${id}/rifiuta`;
      else if (type === 'giustificazioni') endpoint = `/api/giustificazioni/${id}/rifiuta`;
      else if (type === 'timbratura') endpoint = `/api/requests/missing-scans/${id}/rifiuta`;
      const res = await fetch(`${API_URL}${endpoint}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) { showToast('Richiesta rifiutata', 'success'); loadRichieste(); }
      else showToast('Errore rifiuto', 'error');
    } catch (err) { showToast('Errore', 'error'); }
    finally { setActionLoading(prev => ({ ...prev, [id]: false })); }
  }

  function showToast(msg, type = 'success') {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function logout() { localStorage.removeItem("token"); navigate("/"); }

  const presenti    = employees.filter(emp => emp.attivo);
  const assenti     = employees.filter(emp => emp.assente);
  const fuoriTurno  = employees.filter(emp => !emp.attivo && !emp.assente);

  // Richieste filtrate per tab
  let richiesteFiltrate = [];
  if (richieste) {
    const { ferie, giustificazioni, richieste_timbratura } = richieste.richieste;
    // mostriamo solo in_attesa nella dashboard
    const ferieAttesa    = ferie.filter(r => r.stato === 'in_attesa').map(r => ({ ...r, type: 'ferie' }));
    const giustAttesa    = giustificazioni.filter(r => r.stato === 'in_attesa').map(r => ({ ...r, type: 'giustificazioni' }));
    const timbAttesa     = richieste_timbratura.filter(r => r.stato === 'in_attesa').map(r => ({ ...r, type: 'timbratura' }));
    if (richiesteTab === 'all')           richiesteFiltrate = [...ferieAttesa, ...giustAttesa, ...timbAttesa];
    else if (richiesteTab === 'ferie')    richiesteFiltrate = ferieAttesa;
    else if (richiesteTab === 'giust')    richiesteFiltrate = giustAttesa;
    else if (richiesteTab === 'timb')     richiesteFiltrate = timbAttesa;
    richiesteFiltrate.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const totaliInAttesa = richieste?.counts?.totali_in_attesa ?? 0;

  return (
    
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">ContaOre</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Dashboard realtime</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setDark(prev => !prev)} className="w-11 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center">
              {dark ? <Sun size={18} className="text-zinc-200" /> : <Moon size={18} className="text-zinc-700" />}
            </button>
            <button onClick={() => setShowChangePassword(true)} className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">Password</button>
            <button onClick={logout} className="h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium">Logout</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* NAV */}
        <div className="flex gap-3 mb-8 overflow-x-auto">
          {[
            { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
            { title: "Richieste", icon: FileText, path: "/requests" },
            { title: "Pausa aziendale", icon: Calendar, path: "/pause" },
            { title: "Dipendenti", icon: Users, path: "/employees" },
            { title: "Badge", icon: CreditCard, path: "/badges" },
            { title: "Lettori NFC", icon: Radio, path: "/readers" }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} to={item.path}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-medium whitespace-nowrap transition-all ${
                  location.pathname === item.path
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                }`}>
                <Icon size={16} />{item.title}
              </Link>
            );
          })}
        </div>

        {/* STATS PRESENZE */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm text-zinc-500">Dipendenti</p>
            <h3 className="text-4xl font-bold mt-3 text-zinc-900 dark:text-zinc-100">{employees.length}</h3>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm text-zinc-500">Presenti ora</p>
            <h3 className="text-4xl font-bold mt-3 text-green-500">{presenti.length}</h3>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm text-zinc-500">Assenti</p>
            <h3 className="text-4xl font-bold mt-3 text-red-500">{assenti.length}</h3>
          </div>
          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
            <p className="text-sm text-zinc-500">Fuori turno</p>
            <h3 className="text-4xl font-bold mt-3 text-zinc-500">{fuoriTurno.length}</h3>
          </div>
        </div>

        {/* PRESENZE LISTS */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-10">
          <Section title="Presenti ora" color="green" icon={<CheckCircle size={20} className="text-green-500" />} employees={presenti} label="ENTRATO" />
          <Section title="Assenti" color="red" icon={<XCircle size={20} className="text-red-500" />} employees={assenti} label="ASSENTE" />
          <Section title="Fuori turno" color="zinc" icon={<Clock3 size={20} className="text-zinc-500" />} employees={fuoriTurno} label="FUORI ORARIO" />
        </div>

        {/* ── SEZIONE RICHIESTE ── */}
        <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-zinc-500" />
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Richieste in attesa</h2>
              {totaliInAttesa > 0 && (
                <span className="bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300 text-xs font-bold px-2.5 py-1 rounded-full">
                  {totaliInAttesa}
                </span>
              )}
            </div>
            <Link to="/requests" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
              Vedi tutte →
            </Link>
          </div>

          {/* MINI STATS */}
          {richieste && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-2xl bg-blue-50 dark:bg-blue-500/10 p-4">
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Ferie</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{richieste.counts.ferie_in_attesa}</p>
              </div>
              <div className="rounded-2xl bg-purple-50 dark:bg-purple-500/10 p-4">
                <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Giustificazioni</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{richieste.counts.giustificazioni_in_attesa}</p>
              </div>
              <div className="rounded-2xl bg-orange-50 dark:bg-orange-500/10 p-4">
                <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">Timbrature</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{richieste.counts.timbratura_in_attesa}</p>
              </div>
            </div>
          )}

          {/* FILTRI TAB */}
          <div className="flex gap-2 mb-5 overflow-x-auto">
            {[
              { id: 'all', label: 'Tutte', icon: FileText },
              { id: 'ferie', label: 'Ferie', icon: Calendar },
              { id: 'giust', label: 'Giustificazioni', icon: AlertCircle },
              { id: 'timb', label: 'Timbrature', icon: Clock }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setRichiesteTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-medium whitespace-nowrap transition-all ${
                    richiesteTab === tab.id
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-transparent'
                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                  }`}>
                  <Icon size={13} />{tab.label}
                </button>
              );
            })}
          </div>

          {/* LISTA RICHIESTE */}
          {richiesteLoading ? (
            <div className="text-center py-8 text-zinc-500 text-sm">Caricamento...</div>
          ) : richiesteFiltrate.length === 0 ? (
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 p-8 text-center">
              <CheckCircle size={32} className="text-green-400 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">Nessuna richiesta in attesa</p>
            </div>
          ) : (
            <div className="space-y-3">
              {richiesteFiltrate.map(req => {
                const badge = statoBadge(req.stato);
                const isExpanded = expandedId === req.id;
                const dipName = req.dipendenti ? `${req.dipendenti.nome} ${req.dipendenti.cognome}` : 'N/A';
                let typeLabel, typeColor, TypeIcon;
                if (req.type === 'ferie') { TypeIcon = Calendar; typeLabel = 'Ferie'; typeColor = 'bg-blue-500/15 text-blue-600 dark:text-blue-400'; }
                else if (req.type === 'giustificazioni') { TypeIcon = AlertCircle; typeLabel = 'Giustificazione'; typeColor = 'bg-purple-500/15 text-purple-600 dark:text-purple-400'; }
                else { TypeIcon = Clock; typeLabel = 'Timbratura mancata'; typeColor = 'bg-orange-500/15 text-orange-600 dark:text-orange-400'; }

                return (
                  <div key={req.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <button onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-left">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-2 rounded-xl ${typeColor}`}>
                          <TypeIcon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{dipName}</span>
                            <span className="text-xs text-zinc-500">{typeLabel}</span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {req.type === 'ferie' && `${formatDate(req.data_inizio)} → ${formatDate(req.data_fine)}`}
                            {req.type === 'giustificazioni' && formatDate(req.data)}
                            {req.type === 'timbratura' && `${formatDate(req.data)} alle ${req.ora_uscita}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.color}`}>{badge.label}</span>
                        {isExpanded ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4">
                        <div className="mb-4">
                          <p className="text-xs text-zinc-500 mb-1">Motivo / Note:</p>
                          <p className="text-sm text-zinc-900 dark:text-zinc-100">
                            {req.motivo || req.note || 'Nessuna nota'}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => approveRequest(req.type, req.id)} disabled={actionLoading[req.id]}
                            className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                            {actionLoading[req.id] ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CheckCircle size={15} /> Approva</>}
                          </button>
                          <button onClick={() => rejectRequest(req.type, req.id)} disabled={actionLoading[req.id]}
                            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                            {actionLoading[req.id] ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><XCircle size={15} /> Rifiuta</>}
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
      </div>

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, employees, label, color }) {
  return (
    <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-6">
        {icon}
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      </div>
      <div className="space-y-3">
        {employees.map(emp => (
          <div key={emp.id} className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex justify-between">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{emp.nome}</p>
              <p className="text-sm text-zinc-500 mt-1">{emp.badge_uid}</p>
            </div>
            <span className={`text-sm font-medium ${color === "green" ? "text-green-500" : color === "red" ? "text-red-500" : "text-zinc-500"}`}>
              {label}
            </span>
          </div>
        ))}
        {employees.length === 0 && <p className="text-zinc-500 text-sm">Nessun dipendente</p>}
      </div>
    </div>

      );{showChangePassword && (
      <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
  )}
}
