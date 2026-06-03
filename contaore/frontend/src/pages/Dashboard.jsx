import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard, Radio, Sun, Moon,
  CheckCircle, XCircle, Clock3, FileText, Calendar, Coffee
} from "lucide-react";
import { API_URL } from "../api";
import ChangePasswordModal from "../components/ChangePasswordModal";

export default function Dashboard() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [dark, setDark]                         = useState(false);
  const [employees, setEmployees]               = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pendingCount, setPendingCount]         = useState(0);

  const user           = JSON.parse(localStorage.getItem("user") || "{}");
  const portaleAttivo  = user.portale_dipendenti !== false; // default true se non presente

  /* THEME */
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  useEffect(() => {
    if (dark) { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else       { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [dark]);

  /* LOAD */
  useEffect(() => {
    loadDashboard();
    loadPendingCount();
    const i1 = setInterval(loadDashboard, 5000);
    const i2 = setInterval(loadPendingCount, 30000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res   = await fetch(API_URL + "/api/employees", { headers: { Authorization: "Bearer " + token } });
      const data  = await res.json();
      if (data.success) setEmployees(data.employees || []);
    } catch (err) { console.log(err); }
    finally { setLoading(false); }
  }

  async function loadPendingCount() {
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`${API_URL}/api/requests/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      const data  = await res.json();
      if (data.success) setPendingCount(data.counts?.totali_in_attesa ?? 0);
    } catch (err) { console.log(err); }
  }

  function logout() { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/"); }

  const presenti   = employees.filter(emp => emp.attivo);
  const inPausa    = employees.filter(emp => emp.in_pausa);
  const assenti    = employees.filter(emp => emp.assente);
  const fuoriTurno = employees.filter(emp => !emp.attivo && !emp.assente && !emp.in_pausa);

  const navItems = [
    { title: "Dashboard",       icon: LayoutDashboard, path: "/dashboard" },
    { title: "Richieste",       icon: FileText,        path: "/requests",  notifica: pendingCount, nascondiSeSenzaPortale: true },
    { title: "Pausa aziendale", icon: Calendar,        path: "/pause"     },
    { title: "Dipendenti",      icon: Users,           path: "/employees" },
    { title: "Badge",           icon: CreditCard,      path: "/badges"    },
    { title: "Lettori NFC",     icon: Radio,           path: "/readers"   },
  ].filter(item => !(item.nascondiSeSenzaPortale && !portaleAttivo));

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">Timbry</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">Dashboard realtime</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setDark(prev => !prev)}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center"
            >
              {dark ? <Sun size={16} className="sm:w-[18px] sm:h-[18px] text-zinc-200" /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px] text-zinc-700" />}
            </button>
            <button
              onClick={() => setShowChangePassword(true)}
              className="h-9 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 text-xs sm:text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              <span className="hidden sm:inline">Password</span>
              <span className="sm:hidden">🔒</span>
            </button>
            <button
              onClick={logout}
              className="h-9 sm:h-11 px-3 sm:px-5 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium"
            >
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">

        {/* NAV */}
        <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {navItems.map((item) => {
            const Icon     = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.title}
                to={item.path}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <Icon size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">{item.title}</span>
                {item.notifica > 0 && (
                  <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {item.notifica > 9 ? "9+" : item.notifica}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* STATS PRESENZE */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-5 mb-6 sm:mb-8">
          <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-zinc-500">Dipendenti</p>
            <h3 className="text-2xl sm:text-4xl font-bold mt-2 sm:mt-3 text-zinc-900 dark:text-zinc-100">{employees.length}</h3>
          </div>
          <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-zinc-500">Presenti ora</p>
            <h3 className="text-2xl sm:text-4xl font-bold mt-2 sm:mt-3 text-green-500">{presenti.length}</h3>
          </div>
          <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-zinc-500">In pausa</p>
            <h3 className="text-2xl sm:text-4xl font-bold mt-2 sm:mt-3 text-amber-500">{inPausa.length}</h3>
          </div>
          <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-zinc-500">Assenti</p>
            <h3 className="text-2xl sm:text-4xl font-bold mt-2 sm:mt-3 text-red-500">{assenti.length}</h3>
          </div>
          <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
            <p className="text-xs sm:text-sm text-zinc-500">Fuori turno</p>
            <h3 className="text-2xl sm:text-4xl font-bold mt-2 sm:mt-3 text-zinc-500">{fuoriTurno.length}</h3>
          </div>
        </div>

        {/* PRESENZE LISTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <Section title="Presenti ora"  color="green" icon={<CheckCircle size={20} className="text-green-500"  />} employees={presenti}   label="ENTRATO"      />
          <Section title="In pausa"      color="amber" icon={<Coffee      size={20} className="text-amber-500"  />} employees={inPausa}    label="PAUSA"        />
          <Section title="Assenti"       color="red"   icon={<XCircle     size={20} className="text-red-500"    />} employees={assenti}    label="ASSENTE"      />
          <Section title="Fuori turno"   color="zinc"  icon={<Clock3      size={20} className="text-zinc-500"   />} employees={fuoriTurno} label="FUORI ORARIO" />
        </div>

      </div>
    </div>
  );
}

function Section({ title, icon, employees, label, color }) {
  return (
    <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        {icon}
        <h2 className="text-base sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      </div>
      <div className="space-y-2 sm:space-y-3">
        {employees.map(emp => (
          <div key={emp.id} className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex flex-col xs:flex-row xs:justify-between gap-2 xs:gap-0">
            <div className="min-w-0">
              <p className="font-medium text-sm sm:text-base text-zinc-900 dark:text-zinc-100 truncate">{emp.nome}</p>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 sm:mt-1 truncate">{emp.badge_uid}</p>
            </div>
            <span className={`text-xs sm:text-sm font-medium whitespace-nowrap self-start xs:self-auto ${
              color === "green" ? "text-green-500" : color === "red" ? "text-red-500" : color === "amber" ? "text-amber-500" : "text-zinc-500"
            }`}>
              {label}
            </span>
          </div>
        ))}
        {employees.length === 0 && <p className="text-zinc-500 text-xs sm:text-sm">Nessun dipendente</p>}
      </div>
    </div>
  );
}
