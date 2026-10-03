"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday,
  startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppData } from "@/hooks/use-app-data";
import { useQuery } from "@/hooks/use-query";
import { getDayNotesRange, getTransactionsRange, resolveFilters } from "@/lib/db";
import { formatCompact, ymd } from "@/lib/format";
import { dailyTotals } from "@/lib/stats";
import { cn } from "@/lib/utils";
import type { TxFilters } from "@/types";

export function CalendarView({ filters }: { filters: TxFilters }) {
  const { settings, categories, fmt } = useAppData();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const ws = settings.week_start;

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: ws });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: ws });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const from = ymd(gridStart);
  const to = ymd(gridEnd);
  const fKey = JSON.stringify(filters);

  const { data: rows, loading } = useQuery(async () => {
    const r = await resolveFilters(filters, categories);
    // calendar always spans its own range; date filters narrow it further
    const lo = filters.from && filters.from > from ? filters.from : from;
    const hi = filters.to && filters.to < to ? filters.to : to;
    return getTransactionsRange(lo, hi, { ...r, f: { ...r.f, from: "", to: "" } });
  }, [from, to, fKey]);
  const { data: notes } = useQuery(() => getDayNotesRange(from, to), [from, to]);

  const totals = useMemo(() => dailyTotals(rows ?? []), [rows]);
  const noteDates = useMemo(() => new Set((notes ?? []).map((n) => n.date)), [notes]);

  const monthStats = useMemo(() => {
    let spent = 0, income = 0, max = 0, maxDay = "";
    for (const [d, t] of Object.entries(totals)) {
      if (!d.startsWith(format(month, "yyyy-MM"))) continue;
      spent += t.expense;
      income += t.income;
      if (t.expense > max) { max = t.expense; maxDay = d; }
    }
    return { spent, income, max, maxDay };
  }, [totals, month]);

  const maxExpense = Math.max(0, ...days.map((d) => totals[ymd(d)]?.expense ?? 0));
  const weekdays = Array.from({ length: 7 }, (_, i) => format(new Date(2024, 0, 7 + ws + i), "EEE"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <h2 className="min-w-40 text-center text-lg font-semibold">{format(month, "MMMM yyyy")}</h2>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </Button>
        </div>
        <div className="flex gap-4 text-sm tabular-nums">
          <span>
            <span className="text-muted-foreground">Spent </span>
            <b>{fmt(monthStats.spent)}</b>
          </span>
          <span>
            <span className="text-muted-foreground">Income </span>
            <b className="text-emerald-600 dark:text-emerald-400">{fmt(monthStats.income)}</b>
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {weekdays.map((w) => (
            <div key={w} className="py-2">{w}</div>
          ))}
        </div>
        {loading && !rows ? (
          <Skeleton className="m-2 h-96 rounded-xl" />
        ) : (
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = ymd(d);
              const t = totals[key];
              const inMonth = isSameMonth(d, month);
              const intensity = t && maxExpense ? t.expense / maxExpense : 0;
              const pct = t?.expense ? 12 + intensity * 68 : 0;
              return (
                <Link
                  key={key}
                  href={`/history/${key}`}
                  style={pct ? { backgroundColor: `color-mix(in oklab, var(--primary) ${pct}%, transparent)` } : undefined}
                  className={cn(
                    "relative flex min-h-[58px] flex-col items-start justify-between border-b border-r p-1.5 text-left transition-colors hover:bg-primary/10 sm:min-h-[84px] sm:p-2",
                    !inMonth && "opacity-35",
                    "[&:nth-child(7n)]:border-r-0"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday(d) && "bg-primary text-primary-foreground"
                      )}
                    >
                      {format(d, "d")}
                    </span>
                    {noteDates.has(key) && <NotebookPen className="size-3 text-muted-foreground" />}
                  </div>
                  {t && (
                    <div className="w-full">
                      {t.expense > 0 && (
                        <p className="truncate text-[11px] font-semibold tabular-nums sm:text-sm">
                          {formatCompact(t.expense)}
                        </p>
                      )}
                      {t.income > 0 && (
                        <p className="truncate text-[10px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-xs">
                          +{formatCompact(t.income)}
                        </p>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          Less
          {[12, 30, 48, 66, 80].map((p) => (
            <span
              key={p}
              className="size-4 rounded border"
              style={{ backgroundColor: `color-mix(in oklab, var(--primary) ${p}%, transparent)` }}
            />
          ))}
          More
        </div>
        {monthStats.maxDay && (
          <span>
            Highest day: <b className="text-foreground">{format(new Date(monthStats.maxDay + "T00:00"), "MMM d")}</b>{" "}
            ({fmt(monthStats.max)})
          </span>
        )}
      </div>
    </div>
  );
}
