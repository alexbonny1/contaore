import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard,
  Radio, Sun, Moon
} from "lucide-react";
import { API_URL } from "../api";

export default function Badges() {

  const navigate = useNavigate();

  const [dark, setDark] = useState(false);
  const [badges, setBadges] = useState([]);
  const [uid, setUid] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [employeeCognome, setEmployeeCognome] = useState("");
  const [waitingScan, setWaitingScan] = useState(false);

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

  useEffect(() => { loadBadges(); }, []);

  async function loadBadges() {

    try {

      const token = localStorage.getItem("token");

      const response = await fetch(
        API_URL + "/api/tags",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await response.json();

      if (data.success) setBadges(data.tags || []);

    } catch (err) { console.log(err); }

  }

  useEffect(() => {

    if (!waitingScan) return;

    const startedAt = new Date().toISOString();

    const interval = setInterval(async () => {

      try {

        const token = localStorage.getItem("token");

        const response = await fetch(
          API_URL + "/api/latest-read?after=" + encodeURIComponent(startedAt),
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const data = await response.json();

        if (data.success && data.uid) {
          setUid(data.uid);
          setWaitingScan(false);
          clearInterval(interval);
        }

      } catch (err) { console.log(err); }

    }, 1000);

    return () => clearInterval(interval);

  }, [waitingScan]);

  async function createBadge(e) {

    e.preventDefault();

    try {

      const token = localStorage.getItem("token");

      const response = await fetch(
        API_URL + "/api/tags/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            uid,
            employee_name:    employeeName,
            employee_cognome: employeeCognome
          })
        }
      );

      const data = await response.json();

      if (!data.success) {
        alert(
          data.error === "UID_ALREADY_EXISTS"
            ? "Badge già registrato"
            : data.error || "Errore registrazione"
        );
        return;
      }

      alert("Badge registrato");
      setUid("");
      setEmployeeName("");
      setEmployeeCognome("");
      setWaitingScan(false);
      loadBadges();

    } catch (err) {

      console.log(err);
      alert("Errore server");

    }

  }

  async function deleteBadge(id) {

    if (!confirm("Eliminare badge e dipendente associato?")) return;

    try {

      const token = localStorage.getItem("token");

      const response = await fetch(
        API_URL + "/api/tags/" + id,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const data = await response.json();

      if (!data.success) {
        alert(data.error || "Errore");
        return;
      }

      loadBadges();

    } catch (err) {

      console.log(err);
      alert("Errore server");

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
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Gestione badge NFC</p>
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
            { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
            { title: "Dipendenti", icon: Users,          path: "/employees"  },
            { title: "Badge",      icon: CreditCard,     path: "/badges"     },
            { title: "Lettori NFC",icon: Radio,          path: "/readers"    }
          ].map((item) => {
            const Icon = item.icon;
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

        <div className="mb-8">
          <h2 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Badge NFC</h2>
          <p className="text-zinc-500 mt-2">Registra un nuovo badge e associalo a un dipendente</p>
        </div>

        {/* FORM */}

        <form
          onSubmit={createBadge}
          className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-8"
        >

          <div className="mb-6">
            <button
              type="button"
              onClick={() => {
                setUid("");
                setEmployeeName("");
                setEmployeeCognome("");
                setWaitingScan(true);
              }}
              className="h-14 px-8 rounded-2xl bg-black text-white text-sm font-semibold"
            >
              {waitingScan ? "Attendi scansione..." : "Leggi Tag NFC"}
            </button>
          </div>

          {uid && (

            <div className="space-y-4">

              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <CreditCard size={16} className="text-zinc-400 shrink-0" />
                <p className="text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                  {uid}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <input
                  type="text"
                  placeholder="Nome"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="h-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none"
                  required
                />

                <input
                  type="text"
                  placeholder="Cognome"
                  value={employeeCognome}
                  onChange={(e) => setEmployeeCognome(e.target.value)}
                  className="h-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none"
                  required
                />

                <button
                  type="submit"
                  className="h-12 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium"
                >
                  Registra Badge
                </button>

              </div>

            </div>

          )}

        </form>

        {/* LISTA */}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

          {badges.map((badge) => (

            <div
              key={badge.id}
              className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6"
            >

              <div className="flex items-start justify-between mb-5">

                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <CreditCard size={20} className="text-zinc-700 dark:text-zinc-200" />
                </div>

                <button
                  onClick={() => deleteBadge(badge.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Elimina
                </button>

              </div>

              <p className="text-xs text-zinc-400 mb-1">UID</p>
              <h3 className="text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                {badge.uid}
              </h3>

              <p className="text-sm text-zinc-500 mt-3">
                {badge.nome}
              </p>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}