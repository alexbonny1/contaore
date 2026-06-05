import { Link } from "react-router-dom";

export default function LegalFooter() {
  return (
    <div className="mt-6 text-center">
      <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs text-zinc-400">
        <Link
          to="/privacy"
          className="hover:text-zinc-600 dark:hover:text-zinc-200 transition"
        >
          Privacy Policy
        </Link>
        <span aria-hidden>·</span>
        <Link
          to="/cookie-policy"
          className="hover:text-zinc-600 dark:hover:text-zinc-200 transition"
        >
          Cookie Policy
        </Link>
        <span aria-hidden>·</span>
        <span className="text-zinc-300 dark:text-zinc-600">© 2025 Timbry</span>
      </div>
    </div>
  );
}
