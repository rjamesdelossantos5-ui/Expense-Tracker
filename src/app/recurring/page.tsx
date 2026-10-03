"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Pause, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState, ListSkeleton, PageHeader } from "@/components/common";
import { NativeSelect } from "@/components/native-select";
import { useAppData } from "@/hooks/use-app-data";
import { useQuery } from "@/hooks/use-query";
import {
  deleteRecurring, generateDueRecurring, getRecurring, nextOccurrence, saveRecurring,
} from "@/lib/db";
import { CategoryIcon } from "@/lib/icons";
import { currencySymbol, parseTags, parseYmd, todayYmd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Frequency, RecurringTransaction, TxType } from "@/types";

const FREQ: Frequency[] = ["daily", "weekly", "monthly", "yearly"];

export default function RecurringPage() {
  const { catById, fmt, notifyChange } = useAppData();
  const { data, loading, reload } = useQuery(getRecurring, []);
  const [editing, setEditing] = useState<Partial<RecurringTransaction> | null>(null);
  const [deleting, setDeleting] = useState<RecurringTransaction | null>(null);

  async function toggle(r: RecurringTransaction) {
    try {
      await saveRecurring({ ...stripMeta(r), active: !r.active }, r.id);
      if (!r.active) {
        const n = await generateDueRecurring();
        if (n) toast.success(`Added ${n} due transaction${n > 1 ? "s" : ""}`);
      }
      notifyChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Recurring"
        description="Rent, subscriptions, salary… Due items are added automatically whenever you open the app."
        actions={
          <Button onClick={() => setEditing({ type: "expense", frequency: "monthly", start_date: todayYmd(), active: true })}>
            <Plus /> New recurring
          </Button>
        }
      />
      {loading && !data ? (
        <ListSkeleton />
      ) : !data?.length ? (
        <EmptyState icon={<Repeat className="size-6" />} title="No recurring transactions">
          Add things like rent or Netflix and they&apos;ll be logged for you on schedule — no cron job needed.
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((r) => {
            const c = catById(r.category_id);
            const next = nextOccurrence(r);
            return (
              <Card key={r.id} className={cn("gap-3 p-4", !r.active && "opacity-60")}>
                <div className="flex items-center gap-3">
                  <CategoryIcon name={c?.icon} color={c?.color} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.note || c?.name || "Recurring"}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {r.frequency} · {c?.name ?? "Uncategorized"}
                    </p>
                  </div>
                  <p className={cn("font-semibold tabular-nums", r.type === "income" && "text-emerald-600 dark:text-emerald-400")}>
                    {r.type === "income" ? "+" : "−"}{fmt(r.amount)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {!r.active ? <Badge variant="secondary">Paused</Badge> : next ? (
                    <span>Next: <b className="text-foreground">{format(parseYmd(next), "MMM d, yyyy")}</b></span>
                  ) : <Badge variant="secondary">Finished</Badge>}
                  {r.end_date && <span>· ends {format(parseYmd(r.end_date), "MMM d, yyyy")}</span>}
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={r.active ? "Pause" : "Resume"} onClick={() => toggle(r)}>
                      {r.active ? <Pause /> : <Play />}
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(r)}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setDeleting(r)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <RecurringDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          const n = await generateDueRecurring();
          if (n) toast.success(`Added ${n} due transaction${n > 1 ? "s" : ""}`);
          notifyChange();
          reload();
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this recurring item?"
        description="Transactions it already created are kept."
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteRecurring(deleting.id);
            notifyChange();
            toast.success("Deleted");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed");
          }
        }}
      />
    </>
  );
}

function stripMeta(r: RecurringTransaction) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, created_at, last_generated_date, ...rest } = r;
  return rest;
}

function RecurringDialog({
  editing, onClose, onSaved,
}: { editing: Partial<RecurringTransaction> | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { categories, paymentMethods, settings } = useAppData();
  const [d, setD] = useState<Partial<RecurringTransaction>>({});
  const [tags, setTags] = useState("");
  const [last, setLast] = useState<typeof editing>(null);
  if (editing !== last) {
    setLast(editing);
    if (editing) {
      setD(editing);
      setTags((editing.tags ?? []).join(", "));
    }
  }
  const type: TxType = d.type ?? "expense";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d.amount || d.amount <= 0) return toast.error("Enter an amount greater than 0");
    try {
      await saveRecurring(
        {
          type, amount: Number(d.amount), category_id: d.category_id || null,
          payment_method_id: d.payment_method_id || null, note: (d.note ?? "").trim(),
          tags: parseTags(tags), frequency: d.frequency ?? "monthly",
          start_date: d.start_date ?? todayYmd(), end_date: d.end_date || null,
          active: d.active ?? true,
        },
        d.id
      );
      toast.success(d.id ? "Recurring updated" : "Recurring created");
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{d.id ? "Edit recurring" : "New recurring"}</DialogTitle>
          <DialogDescription>Past start dates are back-filled up to today.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(["expense", "income"] as TxType[]).map((t) => (
              <button key={t} type="button" onClick={() => setD({ ...d, type: t, category_id: null })}
                className={cn("rounded-lg py-1.5 text-sm font-medium capitalize", type === t ? "bg-background shadow-sm" : "text-muted-foreground")}>
                {t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Amount ({currencySymbol(settings.currency)})</Label>
              <Input type="number" inputMode="decimal" step="0.01" min="0" required value={d.amount ?? ""}
                onChange={(e) => setD({ ...d, amount: e.target.value === "" ? undefined : Number(e.target.value) })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Repeats</Label>
              <NativeSelect value={d.frequency ?? "monthly"} onChange={(e) => setD({ ...d, frequency: e.target.value as Frequency })}>
                {FREQ.map((f) => <option key={f} value={f} className="capitalize">{f[0].toUpperCase() + f.slice(1)}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <NativeSelect value={d.category_id ?? ""} onChange={(e) => setD({ ...d, category_id: e.target.value || null })}>
                <option value="">Uncategorized</option>
                {categories.filter((c) => c.type === type && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label>Payment method</Label>
              <NativeSelect value={d.payment_method_id ?? ""} onChange={(e) => setD({ ...d, payment_method_id: e.target.value || null })}>
                <option value="">None</option>
                {paymentMethods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Start date</Label>
              <Input type="date" required value={d.start_date ?? ""} onChange={(e) => setD({ ...d, start_date: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>End date (optional)</Label>
              <Input type="date" value={d.end_date ?? ""} onChange={(e) => setD({ ...d, end_date: e.target.value || null })} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Note</Label>
            <Textarea rows={2} placeholder="e.g. Rent, Netflix, Salary" value={d.note ?? ""} onChange={(e) => setD({ ...d, note: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Tags</Label>
            <Input placeholder="comma separated" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
