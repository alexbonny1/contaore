import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard, Radio, Sun, Moon,
  CheckCircle, XCircle, Clock3, FileText, Calendar
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
  const assenti    = employees.filter(emp => emp.assente);
  const fuoriTurno = employees.filter(emp => !emp.attivo && !emp.assente);

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
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Timbry</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Dashboard realtime</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDark(prev => !prev)}
              className="w-11 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center"
            >
              {dark ? <Sun size={18} className="text-zinc-200" /> : <Moon size={18} className="text-zinc-700" />}
            </button>
            <button
              onClick={() => setShowChangePassword(true)}
              className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              Password
            </button>
            <button
              onClick={logout}
              className="h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* NAV */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-1">
          {navItems.map((item) => {
            const Icon     = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.title}
                to={item.path}
                className={`relative flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <Icon size={16} />
                {item.title}
                {item.notifica > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {item.notifica > 9 ? "9+" : item.notifica}
                  </span>
                )}
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
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Section title="Presenti ora"  color="green" icon={<CheckCircle size={20} className="text-green-500" />} employees={presenti}   label="ENTRATO"      />
          <Section title="Assenti"       color="red"   icon={<XCircle     size={20} className="text-red-500"   />} employees={assenti}    label="ASSENTE"      />
          <Section title="Fuori turno"   color="zinc"  icon={<Clock3      size={20} className="text-zinc-500"  />} employees={fuoriTurno} label="FUORI ORARIO" />
        </div>

      </div>
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
            <span className={`text-sm font-medium ${
              color === "green" ? "text-green-500" : color === "red" ? "text-red-500" : "text-zinc-500"
            }`}>
              {label}
            </span>
          </div>
        ))}
        {employees.length === 0 && <p className="text-zinc-500 text-sm">Nessun dipendente</p>}
      </div>
    </div>
  );
}
