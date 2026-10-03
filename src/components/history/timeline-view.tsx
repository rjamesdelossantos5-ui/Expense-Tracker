"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, NotebookPen, SearchX } from "lucide-react";
import { EmptyState, ListSkeleton, TransactionRow, sumBy } from "@/components/common";
import { useAppData } from "@/hooks/use-app-data";
import { useQuery } from "@/hooks/use-query";
import {
  getDayNotesRange, getTimelinePage, resolveFilters, searchDayNotes,
} from "@/lib/db";
import { prettyDate } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Transaction, TxFilters } from "@/types";

export function TimelineView({ filters }: { filters: TxFilters }) {
  const { categories, version, ready, fmt } = useAppData();
  const [rows, setRows] = useState<Transaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const fKey = JSON.stringify(filters);

  const fetchPage = useCallback(
    async (reset: boolean, cur: string | null) => {
      const id = reset ? ++token.current : token.current;
      setLoading(true);
      try {
        const r = await resolveFilters(filters, categories);
        const page = await getTimelinePage(r, reset ? null : cur);
        if (id !== token.current) return;
        setRows((prev) => (reset ? page.rows : [...prev, ...page.rows]));
        setCursor(page.nextCursor);
        setDone(page.nextCursor === null);
        setError(null);
      } catch (e) {
        if (id === token.current) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (id === token.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fKey, categories]
  );

  useEffect(() => {
    if (!ready || !isSupabaseConfigured) {
      if (ready) setLoading(false);
      return;
    }
    fetchPage(true, null);
  }, [fetchPage, version, ready]);

  // infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !done && cursor) fetchPage(false, cursor);
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loading, done, cursor, fetchPage]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of rows) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date)!.push(t);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  const minDate = groups.length ? groups[groups.length - 1][0] : "";
  const maxDate = groups.length ? groups[0][0] : "";
  const { data: notes } = useQuery(() => getDayNotesRange(minDate, maxDate), [minDate, maxDate], !!minDate);
  const noteMap = useMemo(() => new Map((notes ?? []).map((n) => [n.date, n.note])), [notes]);

  const q = filters.search.trim();
  const { data: journalHits } = useQuery(() => searchDayNotes(q), [q], q.length > 0);

  if (error) {
    return <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">{error}</p>;
  }

  return (
    <div className="space-y-5">
      {q && journalHits && journalHits.length > 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <NotebookPen className="size-4 text-primary" /> Day journal matches
          </p>
          <div className="space-y-1">
            {journalHits.slice(0, 6).map((n) => (
              <Link key={n.date} href={`/history/${n.date}`} className="block rounded-lg p-2 text-sm hover:bg-muted">
                <span className="font-medium">{prettyDate(n.date)}</span>
                <span className="line-clamp-1 text-muted-foreground">{n.note}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <ListSkeleton rows={8} />
      ) : groups.length === 0 ? (
        <EmptyState icon={<SearchX className="size-6" />} title="Nothing found">
          No transactions match. Try clearing the filters or adding a transaction with the + button.
        </EmptyState>
      ) : (
        groups.map(([date, list]) => {
          const spent = sumBy(list, "expense");
          const income = sumBy(list, "income");
          const journal = noteMap.get(date);
          return (
            <section key={date} className="overflow-hidden rounded-2xl border bg-card">
              <Link
                href={`/history/${date}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b bg-muted/40 px-4 py-2.5 transition-colors hover:bg-muted"
              >
                <span className="text-sm font-semibold">{prettyDate(date)}</span>
                <span className="flex gap-3 text-xs tabular-nums">
                  {spent > 0 && <span className="font-semibold">−{fmt(spent)}</span>}
                  {income > 0 && (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{fmt(income)}</span>
                  )}
                </span>
              </Link>
              {journal && (
                <p className="flex gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
                  <NotebookPen className="mt-0.5 size-3.5 shrink-0" />
                  <span className="line-clamp-2">{journal}</span>
                </p>
              )}
              <div className="divide-y px-4">
                {list.map((t) => (
                  <TransactionRow key={t.id} t={t} compact />
                ))}
              </div>
            </section>
          );
        })
      )}

      <div ref={sentinel} className="flex h-10 items-center justify-center text-xs text-muted-foreground">
        {loading && rows.length > 0 && <Loader2 className="size-4 animate-spin" />}
        {done && rows.length > 0 && "You've reached the beginning."}
      </div>
    </div>
  );
}
