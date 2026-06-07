import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard, Radio, Sun, Moon,
  FileText, Calendar, Bell, UserX, Clock, TrendingUp,
  WifiOff, BarChart2, ShieldAlert, LogOut, CheckCircle2, XCircle, Settings
} from "lucide-react";
import { API_URL } from "../api";
import { usePullToRefresh, PullIndicator } from "../hooks/usePullToRefresh.jsx";

// ─── notification type definitions ───────────────────────────────────────────

const CONFIGS = [
  {
    tipo:       "assente",
    icon:       UserX,
    color:      "text-red-500",
    bg:         "bg-red-50 dark:bg-red-900/10",
    title:      "Dipendente assente",
    desc:       "Email quando un dipendente non timbra entro la tolleranza dall'inizio del turno",
    targetType: "employee",
    params:     [{ key: "minuti_tolleranza", label: "Minuti di tolleranza", type: "number", min: 5, max: 120, default: 30, unit: "min" }]
  },
  {
    tipo:       "ritardo",
    icon:       Clock,
    color:      "text-amber-500",
    bg:         "bg-amber-50 dark:bg-amber-900/10",
    title:      "Ritardo",
    desc:       "Email quando un dipendente timbra l'entrata dopo l'orario del turno",
    targetType: "employee",
    params:     [{ key: "minuti_tolleranza", label: "Tolleranza prima di notificare", type: "number", min: 0, max: 60, default: 5, unit: "min" }]
  },
  {
    tipo:       "timbratura_mancante",
    icon:       LogOut,
    color:      "text-orange-500",
    bg:         "bg-orange-50 dark:bg-orange-900/10",
    title:      "Timbratura uscita mancante",
    desc:       "Email quando un dipendente è ancora dentro dopo il tempo limite",
    targetType: "employee",
    params:     [{ key: "ore_soglia", label: "Ore senza uscita", type: "number", min: 1, max: 24, default: 10, unit: "h" }]
  },
  {
    tipo:       "badge_non_riconosciuto",
    icon:       ShieldAlert,
    color:      "text-red-600",
    bg:         "bg-red-50 dark:bg-red-900/10",
    title:      "Badge non riconosciuto",
    desc:       "Email quando viene scansionato un badge non registrato nel sistema",
    targetType: "reader",
    params:     []
  },
  {
    tipo:       "lettore_offline",
    icon:       WifiOff,
    color:      "text-zinc-500",
    bg:         "bg-zinc-50 dark:bg-zinc-800/40",
    title:      "Lettore NFC offline",
    desc:       "Email quando un lettore non invia dati da troppo tempo",
    targetType: "reader",
    params:     [{ key: "minuti_assenza", label: "Minuti senza dati", type: "number", min: 15, max: 1440, default: 60, unit: "min" }]
  },
  {
    tipo:       "straordinario_mensile",
    icon:       TrendingUp,
    color:      "text-purple-500",
    bg:         "bg-purple-50 dark:bg-purple-900/10",
    title:      "Straordinario mensile",
    desc:       "Email quando un dipendente supera il limite di ore straordinario nel mese",
    targetType: "employee",
    params:     [{ key: "ore_soglia", label: "Soglia ore straordinario", type: "number", min: 1, max: 200, default: 10, unit: "h" }]
  },
  {
    tipo:       "riepilogo_giornaliero",
    icon:       BarChart2,
    color:      "text-blue-500",
    bg:         "bg-blue-50 dark:bg-blue-900/10",
    title:      "Riepilogo giornaliero",
    desc:       "Email ogni sera con il riepilogo delle presenze del giorno",
    targetType: "employee",
    params:     [{ key: "ora_invio", label: "Ora di invio", type: "time", default: "18:00" }]
  },
  {
    tipo:       "riepilogo_settimanale",
    icon:       Calendar,
    color:      "text-indigo-500",
    bg:         "bg-indigo-50 dark:bg-indigo-900/10",
    title:      "Riepilogo settimanale",
    desc:       "Email ogni lunedì con il riepilogo ore della settimana precedente",
    targetType: "employee",
    params:     [{ key: "ora_invio", label: "Ora di invio (lunedì)", type: "time", default: "08:00" }]
  }
];

// ─── toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-medium ${type === "ok" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
      {type === "ok" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
      {message}
    </div>
  );
}

// ─── toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-700"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-zinc-900 shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

// ─── target selector ─────────────────────────────────────────────────────────

function TargetSelector({ targetType, items, selectedIds, onChange }) {
  const allSelected = !selectedIds || selectedIds.length === 0;
  const label       = targetType === "employee" ? "Dipendenti monitorati" : "Lettori monitorati";
  const countLabel  = targetType === "employee" ? "dipendenti selezionati" : "lettori selezionati";

  function toggleAll() { onChange(null); }

  function toggleItem(id) {
    if (allSelected) {
      onChange([id]);
    } else if (selectedIds.includes(id)) {
      const next = selectedIds.filter(x => x !== id);
      onChange(next.length ? next : null);
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-zinc-100 dark:border-zinc-800">
      <p className="text-[10px] sm:text-xs font-medium text-zinc-500 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={toggleAll}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            allSelected
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          Tutti
        </button>
        {items.map(item => {
          const isSelected = !allSelected && selectedIds.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                isSelected
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {item.nome}
            </button>
          );
        })}
      </div>
      {!allSelected && (
        <p className="mt-1.5 text-[10px] text-zinc-400">{selectedIds.length} {countLabel}</p>
      )}
    </div>
  );
}

// ─── notification card ────────────────────────────────────────────────────────

function NotifCard({ config, setting, employees, readers, onSave, saving }) {
  const Icon   = config.icon;
  const active = setting?.attiva ?? false;

  const [localParams, setLocalParams] = useState(
    () => config.params.reduce((acc, p) => {
      acc[p.key] = (setting?.parametri ?? {})[p.key] ?? p.default;
      return acc;
    }, {})
  );
  const [localTargetIds, setLocalTargetIds]       = useState(() => setting?.target_ids ?? null);
  const [localEmail, setLocalEmail]               = useState(() => setting?.email_destinatario ?? '');
  const [emailDirty, setEmailDirty]               = useState(false);

  useEffect(() => {
    setLocalParams(config.params.reduce((acc, p) => {
      acc[p.key] = (setting?.parametri ?? {})[p.key] ?? p.default;
      return acc;
    }, {}));
    setLocalTargetIds(setting?.target_ids ?? null);
    if (!emailDirty) setLocalEmail(setting?.email_destinatario ?? '');
  }, [setting]);

  const items = config.targetType === "employee" ? employees : readers;

  function handleToggle(val) {
    onSave(config.tipo, val, localParams, localTargetIds, localEmail || null);
  }

  function handleParamChange(key, val) {
    const next = { ...localParams, [key]: val };
    setLocalParams(next);
    onSave(config.tipo, active, next, localTargetIds, localEmail || null);
  }

  function handleTargetChange(newIds) {
    setLocalTargetIds(newIds);
    onSave(config.tipo, active, localParams, newIds, localEmail || null);
  }

  function handleEmailBlur() {
    setEmailDirty(false);
    onSave(config.tipo, active, localParams, localTargetIds, localEmail.trim() || null);
  }

  const lastTriggered = setting?.last_triggered_at
    ? new Date(setting.last_triggered_at).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <div className={`rounded-2xl sm:rounded-3xl border bg-white dark:bg-[#161618] border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 transition-all ${active ? "ring-1 ring-zinc-900/10 dark:ring-zinc-100/10" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`mt-0.5 w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={16} className={`sm:w-[18px] sm:h-[18px] ${config.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">{config.title}</p>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 leading-snug">{config.desc}</p>
          </div>
        </div>
        <Toggle checked={active} onChange={handleToggle} disabled={saving} />
      </div>

      {active && config.params.length > 0 && (
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-3 sm:gap-4">
          {config.params.map(p => (
            <div key={p.key} className="flex flex-col gap-1">
              <label className="text-[10px] sm:text-xs font-medium text-zinc-500">{p.label}</label>
              {p.type === "time" ? (
                <input
                  type="time"
                  value={localParams[p.key] ?? p.default}
                  onChange={e => handleParamChange(p.key, e.target.value)}
                  className="h-8 sm:h-9 px-2 sm:px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none w-28"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={p.min} max={p.max}
                    value={localParams[p.key] ?? p.default}
                    onChange={e => handleParamChange(p.key, Number(e.target.value))}
                    className="h-8 sm:h-9 px-2 sm:px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none w-20"
                  />
                  {p.unit && <span className="text-xs text-zinc-400">{p.unit}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {active && config.targetType && items.length > 0 && (
        <TargetSelector
          targetType={config.targetType}
          items={items}
          selectedIds={localTargetIds}
          onChange={handleTargetChange}
        />
      )}

      {active && (
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <label className="text-[10px] sm:text-xs font-medium text-zinc-500 block mb-1.5">
            Invia a (email personalizzata)
          </label>
          <input
            type="email"
            placeholder="Lascia vuoto per usare l'email del tuo account"
            value={localEmail}
            onChange={e => { setLocalEmail(e.target.value); setEmailDirty(true); }}
            onBlur={handleEmailBlur}
            className="w-full h-8 sm:h-9 px-2 sm:px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none placeholder:text-zinc-400"
          />
        </div>
      )}

      {lastTriggered && (
        <p className="mt-3 text-[10px] sm:text-xs text-zinc-400">Ultimo invio: {lastTriggered}</p>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Notifications() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [dark, setDark]         = useState(false);
  const [settings, setSettings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [readers, setReaders]     = useState([]);
  const token = localStorage.getItem("token");

  const user          = JSON.parse(localStorage.getItem("user") || "{}");
  const portaleAttivo = user.portale_dipendenti !== false;

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  useEffect(() => {
    if (dark) { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [dark]);

  const { pulling, refreshing, distance } = usePullToRefresh(loadSettings)

  useEffect(() => {
    loadSettings();
    loadTargetLists();
    fetch(`${API_URL}/api/requests/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.success) setPendingCount(d.counts?.totali_in_attesa ?? 0); }).catch(() => {});
  }, []);

  async function loadSettings() {
    try {
      const res  = await fetch(`${API_URL}/api/notifications/settings`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setSettings(data.settings || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadTargetLists() {
    try {
      const [empRes, readerRes] = await Promise.all([
        fetch(`${API_URL}/api/employees`,      { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/readers`,        { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const [empData, readerData] = await Promise.all([empRes.json(), readerRes.json()]);
      if (empData.success)    setEmployees((empData.employees || []).map(e => ({ id: e.id, nome: e.nome })));
      if (readerData.success) setReaders((readerData.readers || []).map(r => ({ id: r.id, nome: r.nome || r.reader_id })));
    } catch (e) { console.error(e); }
  }

  const saveDebounceRef = {};

  const handleSave = useCallback((tipo, attiva, parametri, targetIds = null, emailDestinatario = null) => {
    clearTimeout(saveDebounceRef[tipo]);
    saveDebounceRef[tipo] = setTimeout(async () => {
      setSaving(true);
      try {
        const res  = await fetch(`${API_URL}/api/notifications/settings/${tipo}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ attiva, parametri, target_ids: targetIds, email_destinatario: emailDestinatario })
        });
        const data = await res.json();
        if (data.success) {
          setSettings(prev => {
            const exists = prev.find(s => s.tipo === tipo);
            if (exists) return prev.map(s => s.tipo === tipo ? { ...s, attiva, parametri, target_ids: targetIds, email_destinatario: emailDestinatario } : s);
            return [...prev, { tipo, attiva, parametri, target_ids: targetIds, email_destinatario: emailDestinatario, last_triggered_at: null }];
          });
          setToast({ msg: attiva ? "Notifica attivata" : "Notifica disattivata", type: "ok" });
        } else {
          setToast({ msg: "Errore salvataggio", type: "error" });
        }
      } catch (e) {
        console.error(e);
        setToast({ msg: "Errore server", type: "error" });
      } finally { setSaving(false); }
    }, 600);
  }, [token]);

  function logout() { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/"); }

  const navItems = [
    { title: "Dashboard",       icon: LayoutDashboard, path: "/dashboard" },
    { title: "Richieste",       icon: FileText,        path: "/requests",      notifica: pendingCount, nascondiSeSenzaPortale: true },
    { title: "Pausa aziendale", icon: Calendar,        path: "/pause" },
    { title: "Dipendenti",      icon: Users,           path: "/employees" },
    { title: "Badge",           icon: CreditCard,      path: "/badges" },
    { title: "Lettori NFC",     icon: Radio,           path: "/readers" },
    { title: "Notifiche",       icon: Bell,            path: "/notifications" },
    { title: "Impostazioni",    icon: Settings,        path: "/impostazioni"  }
  ].filter(item => !(item.nascondiSeSenzaPortale && !portaleAttivo));

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">Timbry</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">Notifiche email</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setDark(p => !p)} className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center">
              {dark ? <Sun size={16} className="text-zinc-200" /> : <Moon size={16} className="text-zinc-700" />}
            </button>
            <button onClick={logout} className="h-9 sm:h-11 px-3 sm:px-5 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium">
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <PullIndicator pulling={pulling} refreshing={refreshing} distance={distance} />

        {/* NAV */}
        <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.title} to={item.path}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                }`}>
                <Icon size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">{item.title}</span>
                {!isActive && item.notifica > 0 && (
                  <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {item.notifica > 9 ? "9+" : item.notifica}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Notifiche</h2>
          <p className="text-sm sm:text-base text-zinc-500 mt-1 sm:mt-2">
            Le email vengono inviate all'indirizzo del tuo account. Attiva e configura le notifiche che ti interessano.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-8 text-center">
            <p className="text-sm text-zinc-500">Caricamento...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {CONFIGS.map(config => (
              <NotifCard
                key={config.tipo}
                config={config}
                setting={settings.find(s => s.tipo === config.tipo)}
                employees={employees}
                readers={readers}
                onSave={handleSave}
                saving={saving}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
