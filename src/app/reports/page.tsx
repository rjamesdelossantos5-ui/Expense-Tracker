"use client";

import { useMemo, useState } from "react";
import {
  differenceInCalendarDays, endOfMonth, format, min as minDate, parse, startOfMonth, subMonths,
} from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryDonut, CompareBars, MonthBars } from "@/components/charts/charts";
import { PageHeader, StatCard, sumBy } from "@/components/common";
import { useAppData } from "@/hooks/use-app-data";
import { useQuery } from "@/hooks/use-query";
import { getTransactionsRange } from "@/lib/db";
import { parseYmd, prettyDate, ymd } from "@/lib/format";
import { UNCAT, categorySlices, dailyTotals } from "@/lib/stats";
import { cn } from "@/lib/utils";

const monthRange = (m: string) => {
  const d = parse(m, "yyyy-MM", new Date());
  return { from: ymd(startOfMonth(d)), to: ymd(endOfMonth(d)) };
};

export default function ReportsPage() {
  const { fmt, catById, categories } = useAppData();
  const thisMonth = format(new Date(), "yyyy-MM");
  const [mode, setMode] = useState<"month" | "range">("month");
  const [month, setMonth] = useState(thisMonth);
  const [rFrom, setRFrom] = useState(ymd(startOfMonth(new Date())));
  const [rTo, setRTo] = useState(ymd(new Date()));
  const [cmpA, setCmpA] = useState(thisMonth);
  const [cmpB, setCmpB] = useState(format(subMonths(new Date(), 1), "yyyy-MM"));

  const range = mode === "month" ? monthRange(month || thisMonth) : { from: rFrom, to: rTo };
  const validRange = !!range.from && !!range.to && range.from <= range.to;

  const { data: rows, loading } = useQuery(
    () => getTransactionsRange(range.from, range.to), [range.from, range.to], validRange
  );

  const twelveFrom = ymd(startOfMonth(subMonths(new Date(), 11)));
  const { data: yearRows } = useQuery(() => getTransactionsRange(twelveFrom, ymd(new Date())), [twelveFrom]);
  const { data: aRows } = useQuery(() => getTransactionsRange(monthRange(cmpA || thisMonth).from, monthRange(cmpA || thisMonth).to), [cmpA]);
  const { data: bRows } = useQuery(() => getTransactionsRange(monthRange(cmpB || thisMonth).from, monthRange(cmpB || thisMonth).to), [cmpB]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const spent = sumBy(rows, "expense");
    const income = sumBy(rows, "income");
    const end = minDate([parseYmd(range.to), new Date()]);
    const days = Math.max(1, differenceInCalendarDays(end, parseYmd(range.from)) + 1);
    const totals = dailyTotals(rows);
    let topDay = "", topAmt = 0;
    for (const [d, t] of Object.entries(totals)) if (t.expense > topAmt) { topAmt = t.expense; topDay = d; }
    const counts = new Map<string, { name: string; n: number; amt: number }>();
    rows.filter((t) => t.type === "expense").forEach((t) => {
      const c = catById(t.category_id);
      const k = c?.id ?? "none";
      const e = counts.get(k) ?? { name: c?.name ?? UNCAT.name, n: 0, amt: 0 };
      e.n++; e.amt += t.amount;
      counts.set(k, e);
    });
    const top = Array.from(counts.values()).sort((a, b) => b.n - a.n)[0];
    return { spent, income, net: income - spent, avg: spent / days, days, topDay, topAmt, top, slices: categorySlices(rows, catById) };
  }, [rows, range.from, range.to, catById]);

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), 11 - i);
      const key = format(d, "yyyy-MM");
      return {
        label: format(d, "MMM"),
        amount: (yearRows ?? []).filter((t) => t.type === "expense" && t.date.startsWith(key)).reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [yearRows]);

  const compare = useMemo(() => {
    if (!aRows || !bRows) return [];
    const sum = (list: typeof aRows, id: string | null) =>
      list.filter((t) => t.type === "expense" && (t.category_id ?? null) === id).reduce((s, t) => s + t.amount, 0);
    const ids = new Set<string | null>([...aRows, ...bRows].filter((t) => t.type === "expense").map((t) => t.category_id));
    return Array.from(ids)
      .map((id) => {
        const c = categories.find((x) => x.id === id);
        return { name: c?.name ?? UNCAT.name, a: sum(aRows, id), b: sum(bRows, id), color: c?.color ?? UNCAT.color };
      })
      .sort((x, y) => y.a + y.b - (x.a + x.b));
  }, [aRows, bRows, categories]);

  const label = (m: string) => format(parse(m || thisMonth, "yyyy-MM", new Date()), "MMM yyyy");
  const showSkeleton = loading || !stats;

  return (
    <>
      <PageHeader title="Reports" description="Understand where your money goes." />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-xl bg-muted p-1">
          {(["month", "range"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn("rounded-lg px-4 py-1.5 text-sm font-medium transition-all", mode === m ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {m === "month" ? "Month" : "Custom range"}
            </button>
          ))}
        </div>
        {mode === "month" ? (
          <Input type="month" value={month} max={thisMonth} onChange={(e) => setMonth(e.target.value)} className="w-44" />
        ) : (
          <div className="flex items-center gap-2">
            <Input type="date" value={rFrom} onChange={(e) => setRFrom(e.target.value)} className="w-40" />
            <span className="text-muted-foreground">to</span>
            <Input type="date" value={rTo} onChange={(e) => setRTo(e.target.value)} className="w-40" />
          </div>
        )}
      </div>
      {!validRange && <p className="mb-4 text-sm text-destructive">Pick a valid date range.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {showSkeleton ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        ) : (
          <>
            <StatCard label="Total spent" value={fmt(stats.spent)} />
            <StatCard label="Total income" value={fmt(stats.income)} />
            <StatCard label="Net" value={<span className={stats.net < 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}>{fmt(stats.net)}</span>} />
            <StatCard label="Avg per day" value={fmt(stats.avg)} sub={`over ${stats.days} day${stats.days > 1 ? "s" : ""}`} />
            <StatCard label="Highest day" value={stats.topDay ? fmt(stats.topAmt) : "—"} sub={stats.topDay ? prettyDate(stats.topDay) : "No spending"} />
            <StatCard label="Most used category" value={stats.top?.name ?? "—"} sub={stats.top ? `${stats.top.n} transactions · ${fmt(stats.top.amt)}` : undefined} />
          </>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Spending by category</CardTitle></CardHeader>
          <CardContent>
            {showSkeleton ? <Skeleton className="h-52" /> : stats.slices.length ? (
              <CategoryDonut data={stats.slices} />
            ) : <p className="py-10 text-center text-sm text-muted-foreground">No spending in this period.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Last 12 months</CardTitle></CardHeader>
          <CardContent>{yearRows ? <MonthBars data={months} /> : <Skeleton className="h-64" />}</CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Compare two months</CardTitle>
          <div className="flex items-center gap-2">
            <Input type="month" value={cmpA} max={thisMonth} onChange={(e) => setCmpA(e.target.value)} className="w-40" />
            <span className="text-sm text-muted-foreground">vs</span>
            <Input type="month" value={cmpB} max={thisMonth} onChange={(e) => setCmpB(e.target.value)} className="w-40" />
          </div>
        </CardHeader>
        <CardContent>
          {!aRows || !bRows ? <Skeleton className="h-64" /> : compare.length ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                {[["a", cmpA, aRows], ["b", cmpB, bRows]].map(([k, m, r]) => (
                  <div key={k as string} className="rounded-xl bg-muted/50 p-3">
                    <p className="text-muted-foreground">{label(m as string)}</p>
                    <p className="text-lg font-semibold tabular-nums">{fmt(sumBy(r as typeof aRows, "expense"))}</p>
                  </div>
                ))}
              </div>
              <CompareBars data={compare} aLabel={label(cmpA)} bLabel={label(cmpB)} />
            </>
          ) : <p className="py-10 text-center text-sm text-muted-foreground">No spending in either month.</p>}
        </CardContent>
      </Card>
    </>
  );
}
