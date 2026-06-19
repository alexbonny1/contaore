import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Coffee, XCircle, ChevronRight } from "lucide-react";
import { API_URL } from "../api";
import { usePullToRefresh, PullIndicator } from "../hooks/usePullToRefresh.jsx";

export default function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);

  const { pulling, refreshing, distance } = usePullToRefresh(loadDashboard);

  /* LOAD + polling realtime */
  useEffect(() => {
    loadDashboard();
    const i1 = setInterval(loadDashboard, 5000);
    return () => clearInterval(i1);
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

  const presenti = employees.filter(emp => emp.attivo);
  const inPausa   = employees.filter(emp => emp.in_pausa);
  const assenti   = employees.filter(emp => emp.assente);

  return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <PullIndicator pulling={pulling} refreshing={refreshing} distance={distance} />

        {/* RIQUADRO RIASSUNTIVO PRESENZE → Dipendenti */}
        <Link
          to="/employees"
          className="block rounded-3xl bg-white/70 dark:bg-[#161618]/70 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] p-5 sm:p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.10)] active:scale-[0.99]"
        >
          <div className="flex items-center justify-between mb-5 sm:mb-7">
            <div>
              <h2 className="text-lg sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Dipendenti</h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">{employees.length} totali · tocca per i dettagli</p>
            </div>
            <ChevronRight size={22} className="text-zinc-400 shrink-0" />
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-5">
            <StatBlock icon={<CheckCircle size={20} className="text-green-500" />} value={presenti.length} label="Presenti"  color="text-green-500" />
            <StatBlock icon={<Coffee      size={20} className="text-amber-500" />} value={inPausa.length}  label="In pausa"  color="text-amber-500" />
            <StatBlock icon={<XCircle     size={20} className="text-red-500"   />} value={assenti.length}  label="Assenti"   color="text-red-500" />
          </div>
        </Link>

      </div>
  );
}

function StatBlock({ icon, value, label, color }) {
  return (
    <div className="rounded-2xl bg-zinc-100/80 dark:bg-zinc-900/60 p-4 sm:p-5 flex flex-col items-center text-center">
      <div className="mb-2">{icon}</div>
      <span className={`text-3xl sm:text-4xl font-bold ${color}`}>{value}</span>
      <span className="text-xs sm:text-sm text-zinc-500 mt-1">{label}</span>
    </div>
  );
}
