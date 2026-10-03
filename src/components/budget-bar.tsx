"use client";

import { CategoryIcon } from "@/lib/icons";
import { useAppData } from "@/hooks/use-app-data";
import { cn } from "@/lib/utils";

export function BudgetBar({
  label, icon, color, spent, limit,
}: { label: string; icon?: string; color?: string; spent: number; limit: number }) {
  const { fmt } = useAppData();
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const tone = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-emerald-500";
  const remaining = limit - spent;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        <CategoryIcon name={icon ?? "target"} color={color ?? "#6366f1"} size={26} />
        <span className="truncate font-medium">{label}</span>
        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
          {fmt(spent)} / {fmt(limit)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", tone)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p
        className={cn(
          "text-xs tabular-nums",
          pct >= 100 ? "text-red-500" : pct >= 80 ? "text-amber-500" : "text-muted-foreground"
        )}
      >
        {pct >= 100
          ? `Over by ${fmt(-remaining)} (${pct.toFixed(0)}%)`
          : `${fmt(remaining)} left · ${pct.toFixed(0)}% used`}
      </p>
    </div>
  );
}
