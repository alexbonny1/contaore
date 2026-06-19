import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, LogOut } from "lucide-react";

/**
 * Header condiviso area titolare: logo + "Timbry" centrati,
 * toggle tema a sinistra e logout a destra.
 * Self-contained sul tema (agisce su documentElement + localStorage),
 * coerente con la logica già usata nelle pagine.
 */
export default function OwnerHeader() {
  const navigate = useNavigate();
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    if (dark) { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else      { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [dark]);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-[#111113]/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
        <button
          onClick={() => setDark(prev => !prev)}
          aria-label="Cambia tema"
          className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center shrink-0"
        >
          {dark ? <Sun size={16} className="sm:w-[18px] sm:h-[18px] text-zinc-200" /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px] text-zinc-700" />}
        </button>

        <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          <img src="/logo.png" alt="Timbry" className="h-7 sm:h-8 w-auto" />
          <span className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Timbry</span>
        </div>

        <button
          onClick={logout}
          aria-label="Logout"
          className="w-9 h-9 sm:w-auto sm:h-11 sm:px-5 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium flex items-center justify-center gap-2 shrink-0"
        >
          <LogOut size={16} className="sm:hidden" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
