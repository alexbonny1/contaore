import { Component } from "react";
import * as Sentry from "@sentry/react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.VITE_SENTRY_DSN) Sentry.captureException(error, { extra: info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 text-center">
            <h1 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Si è verificato un errore
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Qualcosa non ha funzionato come previsto. Ricarica la pagina per continuare.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full h-11 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium hover:bg-black dark:hover:bg-white transition"
            >
              Ricarica la pagina
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
