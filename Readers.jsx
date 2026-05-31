import { useEffect, useState } from "react";

import {
  Link,
  useNavigate, useLocation
} from "react-router-dom";

import {
  LayoutDashboard,
  Users,
  CreditCard,
  Radio,
  Sun,
  Moon,
  FileText,
  Calendar
} from "lucide-react";

import { API_URL } from "../api";

export default function Readers() {

  const navigate = useNavigate();
  const location = useLocation();

  const [dark, setDark]             = useState(false);
  const [readers, setReaders]       = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  const user          = JSON.parse(localStorage.getItem("user") || "{}");
  const portaleAttivo = user.portale_dipendenti !== false;

  /*
    THEME
  */

  useEffect(() => {

    const saved =
      localStorage.getItem("theme");

    if (saved === "dark") {

      setDark(true);

      document.documentElement
        .classList.add("dark");

    }

  }, []);

  useEffect(() => {

    if (dark) {

      document.documentElement
        .classList.add("dark");

      localStorage.setItem(
        "theme",
        "dark"
      );

    } else {

      document.documentElement
        .classList.remove("dark");

      localStorage.setItem(
        "theme",
        "light"
      );

    }

  }, [dark]);

  /*
    LOAD READERS
  */

  async function loadReaders() {

    try {

      const token =
        localStorage.getItem("token");

      const response =
        await fetch(
          API_URL + "/api/readers",
          {
            headers: {
              Authorization:
                `Bearer ${token}`
            }
          }
        );

      const data =
        await response.json();

      console.log(data);

      if (data.success) {

        setReaders(
          data.readers || []
        );

      }

    } catch (err) {

      console.log(err);

    }

  }

  /*
    AUTO REFRESH
  */

  useEffect(() => {

    loadReaders();

    const interval =
      setInterval(
        loadReaders,
        5000
      );

    return () =>
      clearInterval(interval);

  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/api/requests/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setPendingCount(d.counts?.totali_in_attesa ?? 0); })
      .catch(() => {});
  }, []);

  /*
    LOGOUT
  */

  function logout() {

    localStorage.removeItem("token");

    navigate("/");

  }

  return (

    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">

      {/* HEADER */}

      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">

          <div>

            <h1 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Timbry
            </h1>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              Lettori NFC realtime
            </p>

          </div>

          <div className="flex items-center gap-2 sm:gap-3">

            <button
              onClick={() => setDark(prev => !prev)}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center"
            >

              {dark
                ? <Sun size={16} className="sm:w-[18px] sm:h-[18px] text-zinc-200" />
                : <Moon size={16} className="sm:w-[18px] sm:h-[18px] text-zinc-700" />
              }

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

          {[
            { title: "Dashboard",       icon: LayoutDashboard, path: "/dashboard" },
            { title: "Richieste",       icon: FileText,        path: "/requests",  notifica: pendingCount, nascondiSeSenzaPortale: true },
            { title: "Pausa aziendale", icon: Calendar,        path: "/pause"     },
            { title: "Dipendenti",      icon: Users,           path: "/employees" },
            { title: "Badge",           icon: CreditCard,      path: "/badges"    },
            { title: "Lettori NFC",     icon: Radio,           path: "/readers"   }
          ]
            .filter(item => !(item.nascondiSeSenzaPortale && !portaleAttivo))
            .map((item) => {

            const Icon     = item.icon;
            const isActive = location.pathname === item.path;

            return (

              <Link
                key={item.title}
                to={item.path}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                }`}
              >

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

        {/* TITLE */}

        <div className="mb-5 sm:mb-8">

          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            Lettori NFC
          </h2>

          <p className="text-xs sm:text-sm text-zinc-500 mt-1 sm:mt-2">
            Stato realtime dispositivi
          </p>

        </div>

        {/* EMPTY */}

        {readers.length === 0 && (

          <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-8 sm:p-10 text-center">

            <p className="text-xs sm:text-sm text-zinc-500">
              Nessun lettore trovato
            </p>

          </div>

        )}

        {/* GRID */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">

          {readers.map((reader) => (

            <div
              key={reader.id}
              className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6"
            >

              <div className="flex items-center justify-between mb-4 sm:mb-6">

                <div className="w-10 sm:w-14 h-10 sm:h-14 rounded-lg sm:rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">

                  <Radio
                    size={18}
                    className="sm:w-[22px] sm:h-[22px] text-zinc-700 dark:text-zinc-200"
                  />

                </div>

                <div className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                  reader.online
                    ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                }`}>

                  {reader.online ? "ONLINE" : "OFFLINE"}

                </div>

              </div>

              <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">

                {reader.nome || reader.reader_id}

              </h3>

              <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-zinc-500">

                <p>
                  Reader ID:
                  {" "}
                  {reader.reader_id}
                </p>

                <p>
                  Firmware:
                  {" "}
                  {reader.firmware_version || "-"}
                </p>

                <p>
                  Sede:
                  {" "}
                  {reader.sede || "-"}
                </p>

                <p>
                  Ultimo ping:
                  {" "}
                  {
                    reader.ultimo_ping
                      ? new Date(
                          reader.ultimo_ping
                        ).toLocaleString()
                      : "-"
                  }
                </p>

              </div>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}
