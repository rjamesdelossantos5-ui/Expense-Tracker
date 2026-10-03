"use client";

import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { useAppData } from "@/hooks/use-app-data";
import { isSupabaseConfigured } from "@/lib/supabase";

/** Fetches data, refetching when deps change or any data mutation happens app-wide. */
export function useQuery<T>(fn: () => Promise<T>, deps: DependencyList, enabled = true) {
  const { version, ready } = useAppData();
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const counter = useRef(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback(async () => {
    const id = ++counter.current;
    setLoading(true);
    try {
      const result = await fnRef.current();
      if (id === counter.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === counter.current) setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (id === counter.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !ready || !isSupabaseConfigured) {
      if (ready) setLoading(false);
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ready, enabled, run, ...deps]);

  return { data, loading, error, reload: run };
}
