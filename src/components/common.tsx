"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Copy, MoreVertical, Pencil, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppData } from "@/hooks/use-app-data";
import { useTransactionDialog } from "@/hooks/use-transaction-dialog";
import { CategoryIcon } from "@/lib/icons";
import { prettyDate, prettyTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon, title, children, action,
}: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function StatCard({
  label, value, sub, delta, icon,
}: {
  label: string; value: ReactNode; sub?: ReactNode;
  /** percent change; positive = spending went up (bad) */
  delta?: number | null; icon?: ReactNode;
}) {
  return (
    <Card className="gap-1 p-4">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className="text-xl font-semibold tracking-tight tabular-nums md:text-2xl">{value}</div>
      {delta != null && (
        <div
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            delta > 0 ? "text-rose-500" : "text-emerald-500"
          )}
        >
          {delta > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}% vs last month
        </div>
      )}
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export function TransactionRow({
  t, showDate = false, compact = false, readOnly = false,
}: { t: Transaction; showDate?: boolean; compact?: boolean; readOnly?: boolean }) {
  const { catById, pmById, fmt } = useAppData();
  const { open, duplicate, remove } = useTransactionDialog();
  const cat = catById(t.category_id);
  const pm = pmById(t.payment_method_id);
  const meta = [showDate ? prettyDate(t.date) : null, prettyTime(t.time), cat?.name ?? "Uncategorized", pm?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="group flex items-start gap-3 py-2.5">
      <CategoryIcon name={cat?.icon} color={cat?.color} size={compact ? 34 : 40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-medium">{t.note || cat?.name || "Transaction"}</p>
          <p
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums",
              t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : ""
            )}
          >
            {t.type === "income" ? "+" : "−"}
            {fmt(t.amount)}
          </p>
        </div>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
        {t.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {t.tags.map((tag) => (
              <Link
                key={tag}
                href={`/history?tag=${encodeURIComponent(tag)}`}
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>
      {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Transaction actions"
            className="-mr-1 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => open({ transaction: t })}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicate(t)}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => remove(t)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function sumBy(rows: Transaction[], type: "expense" | "income") {
  return rows.reduce((s, t) => (t.type === type ? s + t.amount : s), 0);
}
