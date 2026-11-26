import { useSyncExternalStore } from "react";
import { isServerSlow, subscribeSlow } from "../lib/api";

/** Honest feedback for free-tier cold starts: say what's happening instead of leaving a silent spinner. */
export default function ServerWaking() {
  const slow = useSyncExternalStore(subscribeSlow, isServerSlow);
  if (!slow) return null;
  return (
    <div role="status" aria-live="polite" className="animate-rise card fixed bottom-4 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 !py-3 text-sm">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-primary" aria-hidden />
      <span>
        <b>Waking up the server…</b> <span className="muted">Free hosting sleeps when idle, so the first request can take up to a minute.</span>
      </span>
    </div>
  );
}
