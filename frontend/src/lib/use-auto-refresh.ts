import { useEffect, useRef, useCallback } from "react";

/**
 * Auto-refresh hook that:
 * 1. Calls `refresh()` when the tab becomes visible again (user switches back)
 * 2. Polls every `intervalMs` milliseconds while the tab is visible
 * 
 * This ensures data stays fresh without manual page reload.
 */
export function useAutoRefresh(
  refresh: () => void | Promise<void>,
  intervalMs = 30_000, // 30 seconds default
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const lastRefreshRef = useRef(Date.now());

  const doRefresh = useCallback(() => {
    // Debounce: skip if refreshed less than 5s ago
    if (Date.now() - lastRefreshRef.current < 5_000) return;
    lastRefreshRef.current = Date.now();
    refreshRef.current();
  }, []);

  useEffect(() => {
    // Refresh on tab visibility change (user comes back to tab)
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        doRefresh();
      }
    }

    // Refresh on window focus (e.g. mobile app switch)
    function handleFocus() {
      doRefresh();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    // Polling interval while tab is visible
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        doRefresh();
      }
    }, intervalMs);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      clearInterval(id);
    };
  }, [intervalMs, doRefresh]);
}
