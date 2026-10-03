"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { toast } from "sonner";
import { generateDueRecurring, loadReference } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Budget, Category, PaymentMethod, Settings } from "@/types";

interface AppData {
  ready: boolean;
  error: string | null;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  budgets: Budget[];
  settings: Settings;
  /** bumps whenever data changes so pages can refetch */
  version: number;
  notifyChange: () => void;
  reloadReference: () => Promise<void>;
  fmt: (n: number) => string;
  catById: (id: string | null | undefined) => Category | undefined;
  pmById: (id: string | null | undefined) => PaymentMethod | undefined;
}

const DEFAULT_SETTINGS: Settings = { id: 1, currency: "PHP", week_start: 0, updated_at: "" };
const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const reloadReference = useCallback(async () => {
    const r = await loadReference();
    setCategories(r.categories);
    setPaymentMethods(r.paymentMethods);
    setBudgets(r.budgets);
    setSettings(r.settings);
  }, []);

  const notifyChange = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    (async () => {
      try {
        await reloadReference();
        const created = await generateDueRecurring();
        if (created > 0) {
          toast.success(`Added ${created} recurring transaction${created > 1 ? "s" : ""}`);
          setVersion((v) => v + 1);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reach the database");
      } finally {
        setReady(true);
      }
    })();
  }, [reloadReference]);

  const value = useMemo<AppData>(() => {
    const cm = new Map(categories.map((c) => [c.id, c]));
    const pm = new Map(paymentMethods.map((p) => [p.id, p]));
    return {
      ready, error, categories, paymentMethods, budgets, settings, version,
      notifyChange, reloadReference,
      fmt: (n: number) => formatMoney(n, settings.currency),
      catById: (id) => (id ? cm.get(id) : undefined),
      pmById: (id) => (id ? pm.get(id) : undefined),
    };
  }, [ready, error, categories, paymentMethods, budgets, settings, version, notifyChange, reloadReference]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData must be used inside AppDataProvider");
  return v;
}
