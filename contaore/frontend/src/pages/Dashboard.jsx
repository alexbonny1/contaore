import {
  useEffect,
  useState
} from "react";

import {
  Link,
  useNavigate
} from "react-router-dom";

import {
  LayoutDashboard,
  Users,
  CreditCard,
  Radio,
  Sun,
  Moon,
  CheckCircle,
  XCircle,
  Clock3
} from "lucide-react";

import { API_URL } from "../api";

export default function Dashboard() {

  const navigate =
    useNavigate();

  const [dark, setDark] =
    useState(false);

  const [employees, setEmployees] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  /*
    THEME
  */

  useEffect(() => {

    const saved =
      localStorage.getItem("theme");

    if (saved === "dark") {

      setDark(true);

      document.documentElement.classList.add(
        "dark"
      );

    }

  }, []);

  useEffect(() => {

    if (dark) {

      document.documentElement.classList.add(
        "dark"
      );

      localStorage.setItem(
        "theme",
        "dark"
      );

    } else {

      document.documentElement.classList.remove(
        "dark"
      );

      localStorage.setItem(
        "theme",
        "light"
      );

    }

  }, [dark]);

  /*
    LOAD
  */

  useEffect(() => {

    loadDashboard();

    const interval =
      setInterval(() => {

        loadDashboard();

      }, 5000);

    return () =>
      clearInterval(interval);

  }, []);

  async function loadDashboard() {

    try {

      setLoading(true);

      const token =
        localStorage.getItem("token");

      /*
        EMPLOYEES
      */

      const response =
        await fetch(
          API_URL +
            "/api/employees",
          {
            headers: {
              Authorization:
                "Bearer " + token
            }
          }
        );

      const data =
        await response.json();

      if (data.success) {

        setEmployees(
          data.employees || []
        );

      }

    } catch (err) {

      console.log(err);

    } finally {

      setLoading(false);

    }

  }

  /*
    PRESENTI / ASSENTI
    USA DIRETTAMENTE
    IL BACKEND
  */

  const presenti =
    employees.filter(
      emp => emp.attivo
    );

  const assenti =
    employees.filter(
      emp =>
        emp.assente
    );

  const fuoriTurno =
    employees.filter(
      emp =>
        !emp.attivo &&
        !emp.assente
    );

  /*
    LOGOUT
  */

  function logout() {

    localStorage.removeItem(
      "token"
    );

    navigate("/");

  }

  return (

    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">

      {/* HEADER */}

      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">

        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          <div>

            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              ContaOre
            </h1>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Dashboard realtime
            </p>

          </div>

          <div className="flex items-center gap-3">

            <button
              onClick={() =>
                setDark(prev => !prev)
              }
              className="w-11 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center"
            >

              {dark
                ? (
                  <Sun
                    size={18}
                    className="text-zinc-200"
                  />
                )
                : (
                  <Moon
                    size={18}
                    className="text-zinc-700"
                  />
                )
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

        {/* NAV */}

        <div className="flex gap-3 mb-8 overflow-x-auto">

          {[
            {
              title: "Dashboard",
              icon: LayoutDashboard,
              path: "/dashboard"
            },
            {
              title: "Dipendenti",
              icon: Users,
              path: "/employees"
            },
            {
              title: "Badge",
              icon: CreditCard,
              path: "/badges"
            },
            {
              title: "Lettori NFC",
              icon: Radio,
              path: "/readers"
            }
          ].map((item) => {

            const Icon =
              item.icon;

            return (

              <Link
                key={item.title}
                to={item.path}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-medium whitespace-nowrap bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
              >

                <Icon size={16} />

                {item.title}

              </Link>

            );

          })}

        </div>

        {/* STATS */}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">

          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">

            <p className="text-sm text-zinc-500">
              Dipendenti
            </p>

            <h3 className="text-4xl font-bold mt-3 text-zinc-900 dark:text-zinc-100">
              {employees.length}
            </h3>

          </div>

          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">

            <p className="text-sm text-zinc-500">
              Presenti ora
            </p>

            <h3 className="text-4xl font-bold mt-3 text-green-500">
              {presenti.length}
            </h3>

          </div>

          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">

            <p className="text-sm text-zinc-500">
              Assenti
            </p>

            <h3 className="text-4xl font-bold mt-3 text-red-500">
              {assenti.length}
            </h3>

          </div>

          <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">

            <p className="text-sm text-zinc-500">
              Fuori turno
            </p>

            <h3 className="text-4xl font-bold mt-3 text-zinc-500">
              {fuoriTurno.length}
            </h3>

          </div>

        </div>

        {/* LISTS */}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* PRESENTI */}

          <Section
            title="Presenti ora"
            color="green"
            icon={
              <CheckCircle
                size={20}
                className="text-green-500"
              />
            }
            employees={presenti}
            label="ENTRATO"
          />

          {/* ASSENTI */}

          <Section
            title="Assenti"
            color="red"
            icon={
              <XCircle
                size={20}
                className="text-red-500"
              />
            }
            employees={assenti}
            label="ASSENTE"
          />

          {/* FUORI TURNO */}

          <Section
            title="Fuori turno"
            color="zinc"
            icon={
              <Clock3
                size={20}
                className="text-zinc-500"
              />
            }
            employees={fuoriTurno}
            label="FUORI ORARIO"
          />

        </div>

      </div>

    </div>

  );

}

function Section({
  title,
  icon,
  employees,
  label,
  color
}) {

  return (

    <div className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">

      <div className="flex items-center gap-3 mb-6">

        {icon}

        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>

      </div>

      <div className="space-y-3">

        {employees.map(emp => (

          <div
            key={emp.id}
            className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex justify-between"
          >

            <div>

              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {emp.nome}
              </p>

              <p className="text-sm text-zinc-500 mt-1">
                {emp.badge_uid}
              </p>

            </div>

            <span
              className={`text-sm font-medium ${
                color === "green"
                  ? "text-green-500"
                  : color === "red"
                  ? "text-red-500"
                  : "text-zinc-500"
              }`}
            >

              {label}

            </span>

          </div>

        ))}

        {employees.length === 0 && (

          <p className="text-zinc-500 text-sm">
            Nessun dipendente
          </p>

        )}

      </div>

    </div>

  );

}