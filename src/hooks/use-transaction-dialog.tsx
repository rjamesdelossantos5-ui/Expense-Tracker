"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { useAppData } from "@/hooks/use-app-data";
import {
  deleteTransaction, getMonthExpenseTotals, restoreTransaction, saveTransaction,
} from "@/lib/db";
import { currencySymbol, hm, nowHm, parseTags, todayYmd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Transaction, TransactionInput, TxType } from "@/types";

interface OpenOpts {
  transaction?: Transaction; // edit
  defaults?: Partial<TransactionInput>; // new / duplicate
}

interface Api {
  open: (opts?: OpenOpts) => void;
  duplicate: (t: Transaction) => void;
  remove: (t: Transaction) => Promise<void>;
}

const Ctx = createContext<Api | null>(null);

export function useTransactionDialog() {
  const v = useContext(Ctx);
  if (!v) throw new Error("TransactionDialogProvider missing");
  return v;
}

export function TransactionDialogProvider({ children }: { children: ReactNode }) {
  const { notifyChange, fmt } = useAppData();
  const [opts, setOpts] = useState<OpenOpts | null>(null);

  const open = useCallback((o?: OpenOpts) => setOpts(o ?? {}), []);
  const duplicate = useCallback((t: Transaction) => {
    setOpts({
      defaults: {
        type: t.type, amount: t.amount, category_id: t.category_id,
        payment_method_id: t.payment_method_id, date: t.date, time: t.time,
        note: t.note, tags: t.tags,
      },
    });
  }, []);

  const remove = useCallback(
    async (t: Transaction) => {
      try {
        await deleteTransaction(t.id);
        notifyChange();
        toast(`Deleted ${t.type} of ${fmt(t.amount)}`, {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                await restoreTransaction(t);
                notifyChange();
                toast.success("Transaction restored");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not restore");
              }
            },
          },
          duration: 7000,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete");
      }
    },
    [notifyChange, fmt]
  );

  const api = useMemo(() => ({ open, duplicate, remove }), [open, duplicate, remove]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <TransactionForm opts={opts} onClose={() => setOpts(null)} />
    </Ctx.Provider>
  );
}

function TransactionForm({ opts, onClose }: { opts: OpenOpts | null; onClose: () => void }) {
  const { categories, paymentMethods, budgets, settings, catById, notifyChange, fmt } = useAppData();
  const editing = opts?.transaction;

  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [time, setTime] = useState(nowHm());
  const [pmId, setPmId] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opts) return;
    const src = opts.transaction ?? opts.defaults;
    setType(src?.type ?? "expense");
    setAmount(src?.amount ? String(src.amount) : "");
    setCategoryId(src?.category_id ?? "");
    setDate(src?.date ?? todayYmd());
    setTime(src?.time ? hm(src.time) : nowHm());
    setPmId(src?.payment_method_id ?? paymentMethods[0]?.id ?? "");
    setNote(src?.note ?? "");
    setTags((src?.tags ?? []).join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  const cats = categories.filter((c) => c.type === type && (!c.archived || c.id === categoryId));

  // keep category valid when switching type
  useEffect(() => {
    if (!opts) return;
    if (categoryId && catById(categoryId)?.type !== type) setCategoryId("");
  }, [type, categoryId, catById, opts]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return toast.error("Enter an amount greater than 0");
    if (!date) return toast.error("Pick a date");
    setSaving(true);
    try {
      const input: TransactionInput = {
        type, amount: value, category_id: categoryId || null,
        payment_method_id: pmId || null, date, time: `${(time || "00:00").slice(0, 5)}:00`,
        note: note.trim(), tags: parseTags(tags),
        recurring_id: editing?.recurring_id ?? null,
      };
      await saveTransaction(input, editing?.id);
      notifyChange();
      onClose();
      toast.success(editing ? "Transaction updated" : "Transaction added");
      if (type === "expense") await warnBudgets(input);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function warnBudgets(input: TransactionInput) {
    if (!budgets.length) return;
    try {
      const { total, byCat } = await getMonthExpenseTotals(input.date);
      for (const b of budgets) {
        const spent = b.category_id ? byCat[b.category_id] ?? 0 : total;
        if (b.category_id && b.category_id !== input.category_id) continue;
        if (spent > b.amount) {
          const name = b.category_id ? catById(b.category_id)?.name ?? "Category" : "Overall";
          toast.warning(`${name} budget exceeded`, {
            description: `${fmt(spent)} spent of ${fmt(b.amount)} this month`,
            duration: 6000,
          });
        }
      }
    } catch {
      /* warning is best-effort */
    }
  }

  return (
    <Dialog open={!!opts} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the details below." : "Record an expense or income."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(["expense", "income"] as TxType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "rounded-lg py-1.5 text-sm font-medium capitalize transition-all",
                  type === t
                    ? t === "expense"
                      ? "bg-background text-rose-600 shadow-sm dark:text-rose-400"
                      : "bg-background text-emerald-600 shadow-sm dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tx-amount">Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {currencySymbol(settings.currency)}
              </span>
              <Input
                id="tx-amount" type="number" inputMode="decimal" step="0.01" min="0"
                placeholder="0.00" autoFocus required value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 pl-8 text-lg font-semibold tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tx-cat">Category</Label>
              <NativeSelect id="tx-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Uncategorized</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tx-pm">Payment method</Label>
              <NativeSelect id="tx-pm" value={pmId} onChange={(e) => setPmId(e.target.value)}>
                <option value="">None</option>
                {paymentMethods.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tx-date">Date</Label>
              <Input id="tx-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tx-time">Time</Label>
              <Input id="tx-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tx-note">Note</Label>
            <Textarea id="tx-note" rows={2} placeholder="What was this for?" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tx-tags">Tags</Label>
            <Input id="tx-tags" placeholder="work, lunch, trip (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {editing ? "Save changes" : "Add transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
