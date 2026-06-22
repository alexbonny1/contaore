import { useEffect, useState } from "react";

import { Radio } from "lucide-react";

import { API_URL } from "../api";
import { usePullToRefresh, PullIndicator } from "../hooks/usePullToRefresh.jsx";

export default function Readers() {

  const [dark, setDark]             = useState(false);
  const [readers, setReaders]       = useState([]);

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


      if (data.success) {

        setReaders(
          data.readers || []
        );

      }

    } catch (err) {


    }

  }

  const { pulling, refreshing, distance } = usePullToRefresh(loadReaders)

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

  return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <PullIndicator pulling={pulling} refreshing={refreshing} distance={distance} />

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

  );

}
