import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {

  const [dark, setDark] = useState(
    localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {

    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }

  }, [dark]);

  return (

    <button
      onClick={() => setDark(!dark)}
      className="
        w-11 h-11 rounded-2xl
        border flex items-center justify-center
        transition
      "
      style={{
        background: "var(--card)",
        borderColor: "var(--border)"
      }}
    >

      {dark
        ? <Sun size={18} />
        : <Moon size={18} />
      }

    </button>

  );
}