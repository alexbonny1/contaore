import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users,
  CreditCard, Radio, Sun, Moon
} from "lucide-react";
import { API_URL } from "../api";

export default function Employees() {

  const navigate = useNavigate();

  const [dark, setDark] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  useEffect(() => {

    loadEmployees();

    const interval = setInterval(() => {
      loadEmployees();
    }, 5000);

    return () => clearInterval(interval);

  }, []);

  async function loadEmployees() {

    try {

      const token = localStorage.getItem("token");

      const response = await fetch(
        API_URL + "/api/employees",
        { headers: { Authorization: "Bearer " + token } }
      );

      const data = await response.json();

      if (data.success) {
        setEmployees(data.employees || []);
      }

    } catch (err) {

      console.log(err);

    } finally {

      setLoading(false);

    }

  }

  function logout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  return (

    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">

      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">ContaOre</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Gestione dipendenti</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDark(prev => !prev)}
              className="w-11 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center"
            >
              {dark
                ? <Sun size={18} className="text-zinc-200" />
                : <Moon size={18} className="text-zinc-700" />
              }
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

        <div className="flex gap-3 mb-8 overflow-x-auto">
          {[
            { title: "Dashboard",   icon: LayoutDashboard, path: "/dashboard" },
            { title: "Dipendenti",  icon: Users,           path: "/employees" },
            { title: "Badge",       icon: CreditCard,      path: "/badges"    },
            { title: "Lettori NFC", icon: Radio,           path: "/readers"   }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                to={item.path}
                key={item.title}
                className="
                  flex items-center gap-2
                  px-5 py-3 rounded-2xl
                  border text-sm font-medium
                  whitespace-nowrap
                  bg-white dark:bg-zinc-900
                  text-zinc-700 dark:text-zinc-300
                  border-zinc-200 dark:border-zinc-800
                "
              >
                <Icon size={16} />
                {item.title}
              </Link>
            );
          })}
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Dipendenti</h2>
          <p className="text-zinc-500 mt-2">Statistiche presenze realtime</p>
        </div>

        {loading && (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-10 text-center">
            <p className="text-zinc-500">Caricamento dipendenti...</p>
          </div>
        )}

        {!loading && employees.length === 0 && (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-10 text-center">
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Nessun dipendente</h3>
            <p className="text-zinc-500">Nessun badge registrato</p>
          </div>
        )}

        {!loading && employees.length > 0 && (

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

            {employees.map((emp) => (

              <div
                key={emp.id}
                onClick={() => navigate("/employees/" + emp.id)}
                className="
                  rounded-3xl
                  border border-zinc-200 dark:border-zinc-800
                  bg-white dark:bg-[#161618]
                  p-6
                  cursor-pointer
                  hover:scale-[1.02]
                  transition-all
                "
              >

                <div className="flex items-start justify-between mb-5">

                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {emp.nome} {emp.cognome}
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      {emp.badge_uid || "Nessun badge"}
                    </p>
                  </div>

                  <div className={`
                    w-3 h-3 rounded-full mt-2
                    ${emp.attivo ? "bg-green-500" : "bg-zinc-400"}
                  `} />

                </div>

                <div className="space-y-3">

                  <Info label="Letture oggi"    value={emp.stats?.today_reads || 0} />
                  <Info label="Letture mese"    value={emp.stats?.month_reads || 0} />
                  <Info label="Ore totali"      value={(emp.stats?.total_hours || 0) + "h"} />

                  <Info
                    label="Ultima presenza"
                    value={
                      emp.stats?.last_read
                        ? new Date(emp.stats.last_read).toLocaleString('it-IT')
                        : "Mai"
                    }
                  />

                </div>

              </div>

            ))}

          </div>

        )}

      </div>

    </div>

  );

}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}