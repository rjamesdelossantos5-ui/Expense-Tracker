import type { Category, Transaction } from "@/types";
import type { Slice } from "@/components/charts/charts";

export const UNCAT = { name: "Uncategorized", color: "#94a3b8" };

export function categorySlices(
  rows: Transaction[],
  catById: (id: string | null | undefined) => Category | undefined,
  type: "expense" | "income" = "expense"
): Slice[] {
  const map = new Map<string, Slice>();
  for (const t of rows) {
    if (t.type !== type) continue;
    const c = catById(t.category_id);
    const key = c?.id ?? "none";
    const s = map.get(key) ?? { name: c?.name ?? UNCAT.name, color: c?.color ?? UNCAT.color, value: 0 };
    s.value += t.amount;
    map.set(key, s);
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

export function dailyTotals(rows: Transaction[]) {
  const map: Record<string, { expense: number; income: number; count: number }> = {};
  for (const t of rows) {
    const d = (map[t.date] ??= { expense: 0, income: 0, count: 0 });
    d[t.type] += t.amount;
    d.count++;
  }
  return map;
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}
