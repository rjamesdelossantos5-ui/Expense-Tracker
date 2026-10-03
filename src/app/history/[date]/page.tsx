"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { addDays, format, subDays } from "date-fns";
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, NotebookPen, Plus, Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CategoryDonut } from "@/components/charts/charts";
import { EmptyState, ListSkeleton, TransactionRow, sumBy } from "@/components/common";
import { useAppData } from "@/hooks/use-app-data";
import { useQuery } from "@/hooks/use-query";
import { useTransactionDialog } from "@/hooks/use-transaction-dialog";
import { getDayNote, getDayTransactions, saveDayNote } from "@/lib/db";
import { parseYmd, ymd } from "@/lib/format";
import { categorySlices } from "@/lib/stats";
import { cn } from "@/lib/utils";

export default function DayDetailPage() {
  const { date } = useParams<{ date: string }>();
  const router = useRouter();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(parseYmd(date).getTime());

  if (!valid) {
    return (
      <EmptyState icon={<Receipt className="size-6" />} title="That date doesn't look right"
        action={<Link href="/history" className="text-sm font-medium text-primary hover:underline">Back to history</Link>}>
        Dates look like 2026-10-03.
      </EmptyState>
    );
  }
  return <DayDetail date={date} go={(d) => router.push(`/history/${d}`)} />;
}

function DayDetail({ date, go }: { date: string; go: (d: string) => void }) {
  const { fmt, catById } = useAppData();
  const { open } = useTransactionDialog();
  const d = parseYmd(date);
  const prev = ymd(subDays(d, 1));
  const next = ymd(addDays(d, 1));

  const { data: rows, loading } = useQuery(() => getDayTransactions(date), [date]);

  const stats = useMemo(() => {
    const list = rows ?? [];
    const spent = sumBy(list, "expense");
    const income = sumBy(list, "income");
    return { spent, income, net: income - spent, slices: categorySlices(list, catById) };
  }, [rows, catById]);

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-2">
        <Link href="/history" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> History
        </Link>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => go(prev)} aria-label="Previous day">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => go(ymd(new Date()))}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => go(next)} aria-label="Next day">
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{format(d, "EEEE")}</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{format(d, "MMMM d, yyyy")}</h1>
        </div>
        <Button onClick={() => open({ defaults: { date } })}>
          <Plus /> Add transaction
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Spent", value: stats.spent, cls: "" },
          { label: "Income", value: stats.income, cls: "text-emerald-600 dark:text-emerald-400" },
          { label: "Net", value: stats.net, cls: stats.net < 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400" },
        ].map((s) => (
          <Card key={s.label} className="gap-1 p-3 md:p-4">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            {loading && !rows ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className={cn("truncate text-base font-semibold tabular-nums md:text-xl", s.cls)}>
                {s.label === "Net" && s.value > 0 ? "+" : ""}
                {fmt(s.value)}
              </p>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Transactions {rows ? `(${rows.length})` : ""}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {loading && !rows ? (
              <ListSkeleton />
            ) : rows && rows.length ? (
              rows.map((t) => <TransactionRow key={t.id} t={t} />)
            ) : (
              <EmptyState
                icon={<Receipt className="size-6" />}
                title="Nothing logged this day"
                action={<Button variant="outline" onClick={() => open({ defaults: { date } })}><Plus /> Add one</Button>}
              >
                Forgot to track something? Add it here and it will be filed under {format(d, "MMM d")}.
              </EmptyState>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Spending by category</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.slices.length ? (
                <CategoryDonut data={stats.slices} height={180} />
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No spending to chart.</p>
              )}
            </CardContent>
          </Card>
          <DayJournal key={date} date={date} />
        </div>
      </div>
    </>
  );
}

function DayJournal({ date }: { date: string }) {
  const { notifyChange } = useAppData();
  const { data, loading } = useQuery(() => getDayNote(date), [date]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const loadedFor = useRef<string | null>(null);
  const [savedText, setSavedText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // load once per date (don't clobber what's being typed on background refetches)
  useEffect(() => {
    loadedFor.current = null;
    setLoaded(false);
    setText("");
    setStatus("idle");
  }, [date]);
  useEffect(() => {
    if (loading || loadedFor.current === date) return;
    loadedFor.current = date;
    const n = data?.note ?? "";
    setSavedText(n);
    setText(n);
    setLoaded(true);
  }, [data, loading, date]);

  async function save(value: string) {
    if (value === savedText) return setStatus("idle");
    setStatus("saving");
    try {
      await saveDayNote(date, value);
      setSavedText(value);
      setStatus("saved");
      notifyChange();
    } catch (e) {
      setStatus("dirty");
      toast.error(e instanceof Error ? e.message : "Could not save journal");
    }
  }

  function onChange(v: string) {
    setText(v);
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(v), 1200);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <NotebookPen className="size-4 text-primary" /> Day journal
        </CardTitle>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {status === "saving" && <><Loader2 className="size-3 animate-spin" /> Saving…</>}
          {status === "saved" && <><Check className="size-3 text-emerald-500" /> Saved</>}
          {status === "dirty" && "Unsaved changes"}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={6}
          value={text}
          disabled={!loaded}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => { if (timer.current) clearTimeout(timer.current); if (status === "dirty") save(text); }}
          placeholder="What did you do today? Where did the money go, and how did it feel?"
          className="resize-y"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={status === "saving" || text === savedText}
          onClick={() => { if (timer.current) clearTimeout(timer.current); save(text); }}
        >
          Save journal
        </Button>
      </CardContent>
    </Card>
  );
}
