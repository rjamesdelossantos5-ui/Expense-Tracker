"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays, subMonths,
} from "date-fns";
import { ArrowRight, CalendarDays, CalendarRange, Receipt, Target, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { BudgetBar } from "@/components/budget-bar";
import { CategoryDonut, SpendAreaChart } from "@/components/charts/charts";
import {
  EmptyState, ListSkeleton, PageHeader, StatCard, TransactionRow, sumBy,
} from "@/components/common";
import { useAppData } from "@/hooks/use-app-data";
import { useQuery } from "@/hooks/use-query";
import { getTransactionsRange } from "@/lib/db";
import { todayYmd, ymd } from "@/lib/format";
import { categorySlices, pctChange } from "@/lib/stats";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { fmt, settings, budgets, catById } = useAppData();
  const now = new Date();
  const today = todayYmd();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const from = ymd(lastMonthStart < subDays(now, 29) ? lastMonthStart : subDays(now, 29));

  const { data: rows, loading } = useQuery(() => getTransactionsRange(from, today), [from, today]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const ws = settings.week_start;
    const weekFrom = ymd(startOfWeek(now, { weekStartsOn: ws }));
    const weekTo = ymd(endOfWeek(now, { weekStartsOn: ws }));
    const mFrom = ymd(thisMonthStart);
    const mTo = ymd(endOfMonth(now));
    const lFrom = ymd(lastMonthStart);
    const lTo = ymd(endOfMonth(lastMonthStart));
    const inR = (a: string, b: string) => rows.filter((t) => t.date >= a && t.date <= b);
    const month = inR(mFrom, mTo);
    const last = inR(lFrom, lTo);
    const monthSpent = sumBy(month, "expense");
    const lastSpent = sumBy(last, "expense");
    // same-length comparison would be fairer, but spec asks month vs last month
    const daily = Array.from({ length: 30 }, (_, i) => {
      const d = subDays(now, 29 - i);
      const key = ymd(d);
      return {
        label: format(d, "MMM d"),
        amount: rows.filter((t) => t.date === key && t.type === "expense").reduce((s, t) => s + t.amount, 0),
      };
    });
    return {
      today: sumBy(rows.filter((t) => t.date === today), "expense"),
      week: sumBy(inR(weekFrom, weekTo), "expense"),
      monthSpent,
      lastSpent,
      delta: pctChange(monthSpent, lastSpent),
      daily,
      slices: categorySlices(month, catById),
      monthRows: month,
      recent: rows.slice(0, 7),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, settings.week_start, catById]);

  const budgetItems = useMemo(() => {
    if (!stats) return [];
    const spentBy: Record<string, number> = {};
    stats.monthRows.forEach((t) => {
      if (t.type === "expense" && t.category_id) spentBy[t.category_id] = (spentBy[t.category_id] ?? 0) + t.amount;
    });
    return budgets
      .map((b) => {
        const c = catById(b.category_id);
        return {
          id: b.id,
          label: b.category_id ? c?.name ?? "Category" : "Overall budget",
          icon: b.category_id ? c?.icon : "target",
          color: b.category_id ? c?.color : "#6366f1",
          spent: b.category_id ? spentBy[b.category_id] ?? 0 : stats.monthSpent,
          limit: b.amount,
          overall: !b.category_id,
        };
      })
      .sort((a, b) => Number(b.overall) - Number(a.overall) || b.spent / b.limit - a.spent / a.limit);
  }, [budgets, stats, catById]);

  const hasData = !!rows && rows.length > 0;

  return (
    <>
      <PageHeader title="Dashboard" description={format(now, "EEEE, MMMM d")} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        ) : (
          <>
            <StatCard label="Spent today" value={fmt(stats.today)} icon={<Wallet className="size-4" />} />
            <StatCard label="This week" value={fmt(stats.week)} icon={<CalendarRange className="size-4" />} />
            <StatCard label="This month" value={fmt(stats.monthSpent)} icon={<CalendarDays className="size-4" />} />
            <StatCard
              label="vs last month"
              value={stats.delta == null ? "New" : `${stats.delta > 0 ? "+" : ""}${stats.delta.toFixed(1)}%`}
              sub={`Last month: ${fmt(stats.lastSpent)}`}
              delta={stats.delta}
            />
          </>
        )}
      </div>

      {!loading && !hasData ? (
        <div className="mt-6">
          <EmptyState
            icon={<Receipt className="size-6" />}
            title="No transactions yet"
            action={
              <Link href="/history" className={cn(buttonVariants({ variant: "outline" }))}>
                Open history
              </Link>
            }
          >
            Tap the + button to log your first expense. Your charts, budgets and history will fill in here.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              {loading || !stats ? <Skeleton className="h-60 w-full" /> : <SpendAreaChart data={stats.daily} />}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Spending by category · {format(now, "MMMM")}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading || !stats ? (
                <Skeleton className="h-52 w-full" />
              ) : stats.slices.length ? (
                <CategoryDonut data={stats.slices} />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">No spending this month yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent transactions</CardTitle>
              <Link href="/history" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View all <ArrowRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="divide-y">
              {loading || !stats ? (
                <ListSkeleton />
              ) : (
                stats.recent.map((t) => <TransactionRow key={t.id} t={t} showDate compact />)
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Budgets</CardTitle>
              <Link href="/budgets" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Manage <ArrowRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : budgetItems.length ? (
                budgetItems.slice(0, 5).map((b) => <BudgetBar key={b.id} {...b} />)
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Target className="mx-auto mb-2 size-6 text-primary" />
                  No budgets yet.{" "}
                  <Link href="/budgets" className="font-medium text-primary hover:underline">
                    Set one
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
