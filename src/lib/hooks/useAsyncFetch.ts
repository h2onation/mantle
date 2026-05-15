"use client";

import { useCallback, useEffect, useState } from "react";

interface AsyncFetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Generic loading/error/data wrapper around a JSON GET. Used by the admin
 * health panels (ApiErrorsPanel, ConfirmHealthPanel, ActiveUsersPanel,
 * SchemaHealthTab) which previously each repeated the same setLoading /
 * setError / try-fetch-finally scaffolding.
 *
 * - Refetches whenever `url` changes.
 * - Pass `null` to skip the fetch (e.g. lazy-load a collapsible panel).
 * - `reload()` triggers an unconditional refetch (e.g. after a mutation).
 * - On error, parses the JSON body for a `{ error }` field and falls back
 *   to `HTTP <status>` or the network-error message.
 */
export function useAsyncFetch<T>(url: string | null): AsyncFetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(url !== null);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);

  useEffect(() => {
    if (url === null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) setError(body.error || `HTTP ${res.status}`);
          return;
        }
        const json = (await res.json()) as T;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Network error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, reloadCount]);

  return { data, loading, error, reload };
}
