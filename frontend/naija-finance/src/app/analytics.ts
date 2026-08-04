/**
 * Lightweight acquisition instrumentation (CGO ask): visit, watchlist_add,
 * signup, share_click. Fire-and-forget POST to /api/analytics/ (no auth).
 */
export function track(event: string, meta: Record<string, unknown> = {}): void {
  try {
    const body = JSON.stringify({ event, meta });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/analytics/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* never break the UI for analytics */ }
}
