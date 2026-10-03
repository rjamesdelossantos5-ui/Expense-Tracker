"use client";

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { useAppData } from "@/hooks/use-app-data";
import { useQuery } from "@/hooks/use-query";
import { getAllTags, hasActiveFilters } from "@/lib/db";
import { EMPTY_FILTERS, type TxFilters } from "@/types";

export function FiltersBar({
  filters, onChange,
}: { filters: TxFilters; onChange: (f: TxFilters) => void }) {
  const { categories, paymentMethods } = useAppData();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(filters.search);
  const { data: tags } = useQuery(getAllTags, []);

  // debounce search typing
  useEffect(() => {
    if (search === filters.search) return;
    const t = setTimeout(() => onChange({ ...filters, search }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => setSearch(filters.search), [filters.search]);

  const set = <K extends keyof TxFilters>(k: K, v: TxFilters[K]) => onChange({ ...filters, [k]: v });
  const activeCount = Object.entries(filters).filter(([k, v]) => k !== "search" && v !== "").length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, journals, categories, tags…"
            className="h-10 pl-9"
          />
        </div>
        <Button variant={open || activeCount ? "secondary" : "outline"} className="h-10" onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
        {hasActiveFilters(filters) && (
          <Button variant="ghost" className="h-10" onClick={() => onChange(EMPTY_FILTERS)}>
            <X /> <span className="hidden sm:inline">Clear</span>
          </Button>
        )}
      </div>

      {open && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 md:grid-cols-4">
          <div className="grid gap-1.5">
            <Label>From</Label>
            <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>To</Label>
            <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <NativeSelect value={filters.type} onChange={(e) => set("type", e.target.value as TxFilters["type"])}>
              <option value="">All</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <NativeSelect value={filters.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.archived ? " (archived)" : ""}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label>Payment method</Label>
            <NativeSelect value={filters.paymentMethodId} onChange={(e) => set("paymentMethodId", e.target.value)}>
              <option value="">All</option>
              {paymentMethods.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label>Tag</Label>
            <NativeSelect value={filters.tag} onChange={(e) => set("tag", e.target.value)}>
              <option value="">All</option>
              {filters.tag && !(tags ?? []).includes(filters.tag) && <option value={filters.tag}>#{filters.tag}</option>}
              {(tags ?? []).map((t) => (
                <option key={t} value={t}>#{t}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label>Min amount</Label>
            <Input type="number" inputMode="decimal" min="0" value={filters.min} onChange={(e) => set("min", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Max amount</Label>
            <Input type="number" inputMode="decimal" min="0" value={filters.max} onChange={(e) => set("max", e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}
