"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, ListTree, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common";
import { CalendarView } from "@/components/history/calendar-view";
import { FiltersBar } from "@/components/history/filters-bar";
import { TimelineView } from "@/components/history/timeline-view";
import { useTransactionDialog } from "@/hooks/use-transaction-dialog";
import { cn } from "@/lib/utils";
import { EMPTY_FILTERS, type TxFilters } from "@/types";

function HistoryInner() {
  const params = useSearchParams();
  const { open } = useTransactionDialog();
  const [view, setView] = useState<"calendar" | "timeline">(params.get("tag") ? "timeline" : "calendar");
  const [filters, setFilters] = useState<TxFilters>({
    ...EMPTY_FILTERS,
    tag: params.get("tag") ?? "",
    categoryId: params.get("category") ?? "",
  });

  // searching or filtering is easiest to read as a list
  const onFilters = (f: TxFilters) => {
    setFilters(f);
    if (f.search && view === "calendar") setView("timeline");
  };

  return (
    <>
      <PageHeader
        title="History"
        description="Browse every day you've tracked — tap a day to see the full story."
        actions={
          <Button onClick={() => open()}>
            <Plus /> Add
          </Button>
        }
      />
      <div className="mb-4 inline-flex rounded-xl bg-muted p-1">
        {(
          [
            ["calendar", "Calendar", CalendarDays],
            ["timeline", "Timeline", ListTree],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
              view === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      <div className="mb-5">
        <FiltersBar filters={filters} onChange={onFilters} />
      </div>
      {view === "calendar" ? <CalendarView filters={filters} /> : <TimelineView filters={filters} />}
    </>
  );
}

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryInner />
    </Suspense>
  );
}
