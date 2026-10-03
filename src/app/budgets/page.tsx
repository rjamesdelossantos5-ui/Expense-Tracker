"use client";

import { useEffect, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetBar } from "@/components/budget-bar";
import { PageHeader } from "@/components/common";
import { useAppData } from "@/hooks/use-app-data";
import { useQuery } from "@/hooks/use-query";
import { deleteBudget, getTransactionsRange, saveBudget } from "@/lib/db";
import { currencySymbol, ymd } from "@/lib/format";
import type { Budget } from "@/types";

export default function BudgetsPage() {
  const { categories, budgets, settings, reloadReference, notifyChange } = useAppData();
  const now = new Date();
  const { data: rows, loading } = useQuery(
    () => getTransactionsRange(ymd(startOfMonth(now)), ymd(endOfMonth(now))),
    [format(now, "yyyy-MM")]
  );

  const { total, byCat } = useMemo(() => {
    const byCat: Record<string, number> = {};
    let total = 0;
    (rows ?? []).forEach((t) => {
      if (t.type !== "expense") return;
      total += t.amount;
      if (t.category_id) byCat[t.category_id] = (byCat[t.category_id] ?? 0) + t.amount;
    });
    return { total, byCat };
  }, [rows]);

  const overall = budgets.find((b) => !b.category_id);
  const cats = categories.filter((c) => c.type === "expense" && (!c.archived || budgets.some((b) => b.category_id === c.id)));

  async function refresh() {
    await reloadReference();
    notifyChange();
  }

  return (
    <>
      <PageHeader
        title="Budgets"
        description={`Monthly limits for ${format(now, "MMMM yyyy")}. Bars turn yellow at 80% and red at 100%.`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-4 p-5 lg:col-span-2">
          <div className="flex items-center gap-2 font-semibold">
            <Target className="size-4 text-primary" /> Overall monthly budget
          </div>
          {loading ? <Skeleton className="h-12" /> : overall ? (
            <BudgetBar label="All spending" spent={total} limit={overall.amount} />
          ) : (
            <p className="text-sm text-muted-foreground">No overall budget yet — you&apos;ve spent {total.toLocaleString()} this month.</p>
          )}
          <LimitEditor budget={overall} categoryId={null} symbol={currencySymbol(settings.currency)} onDone={refresh} />
        </Card>

        {cats.map((c) => {
          const b = budgets.find((x) => x.category_id === c.id);
          return (
            <Card key={c.id} className="gap-4 p-5">
              {b ? (
                <BudgetBar label={c.name} icon={c.icon} color={c.color} spent={byCat[c.id] ?? 0} limit={b.amount} />
              ) : (
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="size-3 rounded-full" style={{ background: c.color }} />
                  {c.name}
                  <span className="ml-auto text-xs font-normal text-muted-foreground">No budget</span>
                </p>
              )}
              <LimitEditor budget={b} categoryId={c.id} symbol={currencySymbol(settings.currency)} onDone={refresh} />
            </Card>
          );
        })}
      </div>
    </>
  );
}

function LimitEditor({
  budget, categoryId, symbol, onDone,
}: { budget?: Budget; categoryId: string | null; symbol: string; onDone: () => Promise<void> }) {
  const [value, setValue] = useState(budget ? String(budget.amount) : "");
  useEffect(() => setValue(budget ? String(budget.amount) : ""), [budget]);

  async function save() {
    const n = Number(value);
    if (!n || n <= 0) return toast.error("Enter an amount greater than 0");
    try {
      await saveBudget(categoryId, n, budget?.id);
      await onDone();
      toast.success("Budget saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function remove() {
    if (!budget) return;
    try {
      await deleteBudget(budget.id);
      await onDone();
      toast.success("Budget removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
        <Input
          type="number" inputMode="decimal" min="0" placeholder="Monthly limit"
          value={value} onChange={(e) => setValue(e.target.value)} className="pl-8"
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
      </div>
      <Button size="sm" onClick={save} disabled={!value || Number(value) === budget?.amount}>
        {budget ? "Update" : "Set"}
      </Button>
      {budget && <Button size="sm" variant="ghost" onClick={remove}>Remove</Button>}
    </div>
  );
}
