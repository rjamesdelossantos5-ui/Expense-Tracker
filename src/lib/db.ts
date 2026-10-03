/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  addDays, addMonths, addWeeks, addYears, endOfMonth, startOfMonth,
} from "date-fns";
import { supabase } from "@/lib/supabase";
import { parseYmd, todayYmd, ymd } from "@/lib/format";
import type {
  Budget, Category, DayNote, PaymentMethod, RecurringTransaction, Settings,
  Transaction, TransactionInput, TxFilters,
} from "@/types";

const PAGE = 1000;
export const TIMELINE_PAGE = 150;

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

const num = (t: any): Transaction => ({ ...t, amount: Number(t.amount), tags: t.tags ?? [] });

/** Runs a query factory repeatedly to get past the 1000-row API limit. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    fail(error);
    out.push(...(data as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/* ---------------- reference data ---------------- */

export async function loadReference() {
  const [c, p, s, b] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("name"),
    supabase.from("payment_methods").select("*").order("sort_order").order("name"),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("budgets").select("*"),
  ]);
  fail(c.error); fail(p.error); fail(s.error); fail(b.error);
  let settings = s.data as Settings | null;
  if (!settings) {
    const ins = await supabase.from("settings").insert({ id: 1 }).select().single();
    fail(ins.error);
    settings = ins.data as Settings;
  }
  return {
    categories: c.data as Category[],
    paymentMethods: p.data as PaymentMethod[],
    settings,
    budgets: (b.data as any[]).map((x) => ({ ...x, amount: Number(x.amount) })) as Budget[],
  };
}

/* ---------------- filters ---------------- */

export interface ResolvedFilters {
  f: TxFilters;
  categoryIds: string[];
  journalDates: string[];
}

const clean = (s: string) => s.replace(/[,()"\\{}%*]/g, " ").trim();

export async function resolveFilters(f: TxFilters, categories: Category[]): Promise<ResolvedFilters> {
  const q = clean(f.search).toLowerCase();
  let journalDates: string[] = [];
  let categoryIds: string[] = [];
  if (q) {
    categoryIds = categories.filter((c) => c.name.toLowerCase().includes(q)).map((c) => c.id);
    const { data, error } = await supabase
      .from("day_notes").select("date").ilike("note", `%${q}%`).limit(500);
    fail(error);
    journalDates = (data ?? []).map((d: any) => d.date);
  }
  return { f, categoryIds, journalDates };
}

export function applyFilters(query: any, r: ResolvedFilters) {
  const { f } = r;
  if (f.from) query = query.gte("date", f.from);
  if (f.to) query = query.lte("date", f.to);
  if (f.categoryId) query = query.eq("category_id", f.categoryId);
  if (f.paymentMethodId) query = query.eq("payment_method_id", f.paymentMethodId);
  if (f.tag) query = query.contains("tags", [f.tag.replace(/^#/, "").toLowerCase()]);
  if (f.type) query = query.eq("type", f.type);
  if (f.min !== "" && !isNaN(Number(f.min))) query = query.gte("amount", Number(f.min));
  if (f.max !== "" && !isNaN(Number(f.max))) query = query.lte("amount", Number(f.max));
  const q = clean(f.search).toLowerCase();
  if (q) {
    const ors = [`note.ilike.%${q}%`, `tags.cs.{"${q}"}`];
    if (r.categoryIds.length) ors.push(`category_id.in.(${r.categoryIds.join(",")})`);
    if (r.journalDates.length) ors.push(`date.in.(${r.journalDates.join(",")})`);
    query = query.or(ors.join(","));
  }
  return query;
}

export const hasActiveFilters = (f: TxFilters) => Object.values(f).some((v) => v !== "");

/* ---------------- transactions ---------------- */

export async function getTransactionsRange(from: string, to: string, r?: ResolvedFilters) {
  const rows = await fetchAll<any>((a, b) => {
    let q: any = supabase.from("transactions").select("*").gte("date", from).lte("date", to);
    if (r) q = applyFilters(q, r);
    return q.order("date", { ascending: false }).order("time", { ascending: false }).range(a, b);
  });
  return rows.map(num);
}

export async function getDayTransactions(date: string) {
  const { data, error } = await supabase
    .from("transactions").select("*").eq("date", date).order("time", { ascending: true });
  fail(error);
  return (data as any[]).map(num);
}

/** Keyset pagination by day so a day's totals are never split across pages. */
export async function getTimelinePage(r: ResolvedFilters, cursor: string | null) {
  let q: any = applyFilters(supabase.from("transactions").select("*"), r);
  if (cursor) q = q.lt("date", cursor);
  const { data, error } = await q
    .order("date", { ascending: false }).order("time", { ascending: false }).limit(TIMELINE_PAGE);
  fail(error);
  let rows = (data as any[]).map(num);
  let nextCursor: string | null = null;
  if (rows.length === TIMELINE_PAGE) {
    const lastDate = rows[rows.length - 1].date;
    const rest = await fetchAll<any>((a, b) =>
      applyFilters(supabase.from("transactions").select("*"), r)
        .eq("date", lastDate).order("time", { ascending: false }).range(a, b)
    );
    rows = [...rows.filter((x) => x.date !== lastDate), ...rest.map(num)];
    nextCursor = lastDate;
  }
  return { rows, nextCursor };
}

export async function saveTransaction(input: TransactionInput, id?: string) {
  const payload = { ...input, updated_at: new Date().toISOString() };
  if (id) {
    const { data, error } = await supabase.from("transactions").update(payload).eq("id", id).select().single();
    fail(error);
    return num(data);
  }
  const { data, error } = await supabase.from("transactions").insert(payload).select().single();
  fail(error);
  return num(data);
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  fail(error);
}

export async function restoreTransaction(t: Transaction) {
  const { error } = await supabase.from("transactions").insert(t);
  fail(error);
}

export async function insertTransactions(rows: TransactionInput[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("transactions").insert(rows.slice(i, i + 500));
    fail(error);
  }
}

export async function getAllTags() {
  const { data, error } = await supabase.from("transactions").select("tags").neq("tags", "{}").limit(5000);
  fail(error);
  const set = new Set<string>();
  (data as any[]).forEach((r) => (r.tags as string[]).forEach((t) => set.add(t)));
  return Array.from(set).sort();
}

/** Month spend, used for budget-exceeded warnings. */
export async function getMonthExpenseTotals(dateStr: string) {
  const d = parseYmd(dateStr);
  const rows = await getTransactionsRange(ymd(startOfMonth(d)), ymd(endOfMonth(d)));
  const byCat: Record<string, number> = {};
  let total = 0;
  for (const t of rows) {
    if (t.type !== "expense") continue;
    total += t.amount;
    if (t.category_id) byCat[t.category_id] = (byCat[t.category_id] ?? 0) + t.amount;
  }
  return { total, byCat };
}

/* ---------------- day notes ---------------- */

export async function getDayNote(date: string) {
  const { data, error } = await supabase.from("day_notes").select("*").eq("date", date).maybeSingle();
  fail(error);
  return (data as DayNote | null) ?? null;
}

export async function getDayNotesRange(from: string, to: string) {
  const { data, error } = await supabase.from("day_notes").select("*").gte("date", from).lte("date", to);
  fail(error);
  return data as DayNote[];
}

export async function saveDayNote(date: string, note: string) {
  if (!note.trim()) {
    const { error } = await supabase.from("day_notes").delete().eq("date", date);
    fail(error);
    return;
  }
  const { error } = await supabase
    .from("day_notes").upsert({ date, note, updated_at: new Date().toISOString() });
  fail(error);
}

export async function searchDayNotes(q: string) {
  const { data, error } = await supabase
    .from("day_notes").select("*").ilike("note", `%${clean(q)}%`).order("date", { ascending: false }).limit(50);
  fail(error);
  return data as DayNote[];
}

/* ---------------- budgets ---------------- */

export async function saveBudget(categoryId: string | null, amount: number, existingId?: string) {
  if (existingId) {
    const { error } = await supabase.from("budgets").update({ amount }).eq("id", existingId);
    fail(error);
  } else {
    const { error } = await supabase.from("budgets").insert({ category_id: categoryId, amount });
    fail(error);
  }
}

export async function deleteBudget(id: string) {
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  fail(error);
}

/* ---------------- categories / payment methods / settings ---------------- */

export async function upsertCategory(c: Partial<Category> & { name: string; type: Category["type"] }) {
  const { id, ...rest } = c;
  if (id) {
    const { error } = await supabase.from("categories").update(rest).eq("id", id);
    fail(error);
  } else {
    const { error } = await supabase.from("categories").insert({ sort_order: 100, ...rest });
    fail(error);
  }
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  fail(error);
}

export async function addPaymentMethod(name: string) {
  const { error } = await supabase.from("payment_methods").insert({ name, sort_order: 100 });
  fail(error);
}
export async function renamePaymentMethod(id: string, name: string) {
  const { error } = await supabase.from("payment_methods").update({ name }).eq("id", id);
  fail(error);
}
export async function deletePaymentMethod(id: string) {
  const { error } = await supabase.from("payment_methods").delete().eq("id", id);
  fail(error);
}

export async function updateSettings(patch: Partial<Pick<Settings, "currency" | "week_start">>) {
  const { error } = await supabase
    .from("settings").upsert({ id: 1, ...patch, updated_at: new Date().toISOString() });
  fail(error);
}

export async function deleteAllData() {
  const steps: [string, string][] = [
    ["transactions", "id"], ["recurring_transactions", "id"], ["budgets", "id"],
    ["day_notes", "date"],
  ];
  for (const [table, col] of steps) {
    const { error } = await supabase.from(table).delete().not(col, "is", null);
    fail(error);
  }
}

/* ---------------- recurring ---------------- */

export async function getRecurring() {
  const { data, error } = await supabase
    .from("recurring_transactions").select("*").order("created_at", { ascending: false });
  fail(error);
  return (data as any[]).map((r) => ({ ...r, amount: Number(r.amount), tags: r.tags ?? [] })) as RecurringTransaction[];
}

export async function saveRecurring(
  r: Omit<RecurringTransaction, "id" | "created_at" | "last_generated_date">,
  id?: string
) {
  if (id) {
    const { error } = await supabase.from("recurring_transactions").update(r).eq("id", id);
    fail(error);
  } else {
    const { error } = await supabase.from("recurring_transactions").insert(r);
    fail(error);
  }
}

export async function deleteRecurring(id: string) {
  const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
  fail(error);
}

function occurrence(start: Date, freq: RecurringTransaction["frequency"], n: number) {
  switch (freq) {
    case "daily": return addDays(start, n);
    case "weekly": return addWeeks(start, n);
    case "monthly": return addMonths(start, n);
    case "yearly": return addYears(start, n);
  }
}

let generating: Promise<number> | null = null;

/** Creates every due recurring transaction not generated yet. Returns count created. */
export function generateDueRecurring(): Promise<number> {
  if (generating) return generating;
  generating = (async () => {
    const today = todayYmd();
    const items = (await getRecurring()).filter((r) => r.active && r.start_date <= today);
    let created = 0;
    for (const r of items) {
      const start = parseYmd(r.start_date);
      const rows: TransactionInput[] = [];
      let latest: string | null = null;
      for (let n = 0; n < 1000; n++) {
        const d = ymd(occurrence(start, r.frequency, n));
        if (d > today) break;
        if (r.end_date && d > r.end_date) break;
        if (r.last_generated_date && d <= r.last_generated_date) continue;
        rows.push({
          type: r.type, amount: r.amount, category_id: r.category_id,
          payment_method_id: r.payment_method_id, date: d, time: "08:00:00",
          note: r.note, tags: r.tags, recurring_id: r.id,
        });
        latest = d;
      }
      if (!rows.length) continue;
      const { error } = await supabase
        .from("transactions")
        .upsert(rows, { onConflict: "recurring_id,date", ignoreDuplicates: true });
      fail(error);
      const u = await supabase
        .from("recurring_transactions").update({ last_generated_date: latest }).eq("id", r.id);
      fail(u.error);
      created += rows.length;
    }
    return created;
  })().finally(() => {
    setTimeout(() => (generating = null), 5000);
  });
  return generating;
}

export function nextOccurrence(r: RecurringTransaction): string | null {
  const start = parseYmd(r.start_date);
  for (let n = 0; n < 2000; n++) {
    const s = ymd(occurrence(start, r.frequency, n));
    if (r.end_date && s > r.end_date) return null;
    if (!r.last_generated_date || s > r.last_generated_date) return s;
  }
  return null;
}
