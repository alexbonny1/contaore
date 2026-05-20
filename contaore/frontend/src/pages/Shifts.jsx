import { useEffect, useState } from "react";

import {
  Sun,
  Moon,
  Plus,
  Clock3
} from "lucide-react";

import { API_URL } from "../api";

export default function Shifts() {

  const [dark, setDark] = useState(false);

  const [loading, setLoading] = useState(true);

  const [shifts, setShifts] = useState([]);

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

    loadShifts();

  }, []);

  async function loadShifts() {

    try {

      setLoading(true);

      const response = await fetch(
        API_URL + "/api/shifts",
        {
          headers: {
            Authorization:
              "Bearer " + localStorage.getItem("token")
          }
        }
      );

      const data = await response.json();

      if (data.ok) {

        setShifts(data.data || []);

      }

    } catch (err) {

      console.log(err);

    } finally {

      setLoading(false);

    }

  }

  return (

    <div className="
      min-h-screen
      bg-zinc-100 dark:bg-[#0f0f10]
      transition-colors duration-300
    ">

      {/* HEADER */}

      <header className="
        sticky top-0 z-50
        border-b border-zinc-200 dark:border-zinc-800
        bg-white/80 dark:bg-[#111113]/80
        backdrop-blur-xl
      ">

        <div className="
          max-w-7xl mx-auto
          px-6 h-16
          flex items-center justify-between
        ">

          <div>

            <h1 className="
              text-lg font-semibold
              text-zinc-900 dark:text-zinc-100
            ">
              ContaOre
            </h1>

            <p className="
              text-xs
              text-zinc-500 dark:text-zinc-400
            ">
              Gestione turni
            </p>

          </div>

          <button
            onClick={() => setDark(prev => !prev)}
            className="
              w-11 h-11 rounded-2xl
              border border-zinc-200 dark:border-zinc-700
              bg-white dark:bg-zinc-900
              flex items-center justify-center
            "
          >

            {dark
              ? <Sun size={18} className="text-zinc-200" />
              : <Moon size={18} className="text-zinc-700" />
            }

          </button>

        </div>

      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* TOP */}

        <div className="
          flex flex-col md:flex-row
          items-start md:items-center
          justify-between gap-4
          mb-8
        ">

          <div>

            <h2 className="
              text-3xl font-semibold
              text-zinc-900 dark:text-zinc-100
            ">
              Turni
            </h2>

            <p className="text-zinc-500 mt-2">
              Configurazione turni di lavoro
            </p>

          </div>

          <button
            className="
              h-12 px-5 rounded-2xl
              bg-zinc-900 text-white
              dark:bg-zinc-100 dark:text-black
              text-sm font-medium
              flex items-center gap-2
            "
          >

            <Plus size={16} />

            Nuovo turno

          </button>

        </div>

        {/* CONTENT */}

        {loading ? (

          <div className="
            rounded-3xl
            border border-zinc-200 dark:border-zinc-800
            bg-white dark:bg-[#161618]
            p-10 text-center
          ">

            <p className="text-zinc-500">
              Caricamento turni...
            </p>

          </div>

        ) : shifts.length === 0 ? (

          <div className="
            rounded-3xl
            border border-zinc-200 dark:border-zinc-800
            bg-white dark:bg-[#161618]
            p-10 text-center
          ">

            <p className="text-zinc-500">
              Nessun turno configurato
            </p>

          </div>

        ) : (

          <div className="
            grid grid-cols-1
            md:grid-cols-2
            xl:grid-cols-3
            gap-5
          ">

            {shifts.map((shift) => (

              <div
                key={shift.id}
                className="
                  rounded-3xl
                  border border-zinc-200 dark:border-zinc-800
                  bg-white dark:bg-[#161618]
                  p-6
                "
              >

                <div className="
                  flex items-start justify-between
                  mb-6
                ">

                  <div>

                    <h3 className="
                      text-xl font-semibold
                      text-zinc-900 dark:text-zinc-100
                    ">
                      {shift.nome}
                    </h3>

                    <p className="text-zinc-500 mt-1">
                      Turno lavorativo
                    </p>

                  </div>

                  <div className="
                    w-12 h-12 rounded-2xl
                    bg-zinc-100 dark:bg-zinc-800
                    flex items-center justify-center
                  ">

                    <Clock3
                      size={20}
                      className="
                        text-zinc-700 dark:text-zinc-200
                      "
                    />

                  </div>

                </div>

                <div className="space-y-4">

                  <Info
                    label="Ingresso"
                    value={shift.ingresso || "-"}
                  />

                  <Info
                    label="Uscita"
                    value={shift.uscita || "-"}
                  />

                  <Info
                    label="Pausa"
                    value={
                      shift.pausa_minuti
                        ? `${shift.pausa_minuti} min`
                        : "-"
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

    <div className="
      flex items-center justify-between
    ">

      <span className="
        text-sm text-zinc-500
      ">
        {label}
      </span>

      <span className="
        text-sm font-medium
        text-zinc-900 dark:text-zinc-100
      ">
        {value}
      </span>

    </div>

  );

}