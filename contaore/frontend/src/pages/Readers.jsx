import { useEffect, useState } from "react";

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
  Moon
} from "lucide-react";

import { API_URL } from "../api";

export default function Readers() {

  const navigate = useNavigate();

  const [dark, setDark] = useState(false);

  const [readers, setReaders] = useState([]);

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

        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

          <div>

            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              ContaOre
            </h1>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Lettori NFC realtime
            </p>

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

            const Icon = item.icon;

            return (

              <Link
                key={item.title}
                to={item.path}
                className="
                  flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-medium transition-all whitespace-nowrap
                  bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300
                  border-zinc-200 dark:border-zinc-800
                "
              >

                <Icon size={16} />

                {item.title}

              </Link>

            );

          })}

        </div>

        {/* TITLE */}

        <div className="mb-8">

          <h2 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            Lettori NFC
          </h2>

          <p className="text-zinc-500 mt-2">
            Stato realtime dispositivi
          </p>

        </div>

        {/* EMPTY */}

        {readers.length === 0 && (

          <div className="
            rounded-3xl
            border border-zinc-200 dark:border-zinc-800
            bg-white dark:bg-[#161618]
            p-10
            text-center
          ">

            <p className="text-zinc-500">
              Nessun lettore trovato
            </p>

          </div>

        )}

        {/* GRID */}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

          {readers.map((reader) => (

            <div
              key={reader.id}
              className="
                rounded-3xl
                bg-white dark:bg-[#161618]
                border border-zinc-200 dark:border-zinc-800
                p-6
              "
            >

              <div className="flex items-center justify-between mb-6">

                <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">

                  <Radio
                    size={22}
                    className="text-zinc-700 dark:text-zinc-200"
                  />

                </div>

                <div className={`
                  px-3 py-1 rounded-full text-xs font-medium
                  ${reader.online
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                  }
                `}>

                  {reader.online
                    ? "ONLINE"
                    : "OFFLINE"
                  }

                </div>

              </div>

              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">

                {reader.nome || reader.reader_id}

              </h3>

              <div className="mt-4 space-y-2 text-sm text-zinc-500">

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