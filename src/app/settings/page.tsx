"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Pencil, Plus, Sun, Trash2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/common";
import { NativeSelect } from "@/components/native-select";
import { useAppData } from "@/hooks/use-app-data";
import {
  addPaymentMethod, deleteAllData, deletePaymentMethod, renamePaymentMethod, updateSettings,
} from "@/lib/db";
import { CURRENCIES, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/types";

export default function SettingsPage() {
  const { settings, paymentMethods, reloadReference, notifyChange } = useAppData();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [newPm, setNewPm] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [delPm, setDelPm] = useState<PaymentMethod | null>(null);
  const [wipe, setWipe] = useState(false);

  async function patch(p: Parameters<typeof updateSettings>[0]) {
    try {
      await updateSettings(p);
      await reloadReference();
      notifyChange();
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function run(fn: () => Promise<void>, ok: string) {
    try {
      await fn();
      await reloadReference();
      notifyChange();
      toast.success(ok);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Failed";
      toast.error(m.includes("duplicate") ? "That name already exists" : m);
    }
  }

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Choose how the app looks.</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {([["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]] as const).map(([v, l, Icon]) => (
                <button key={v} onClick={() => setTheme(v)}
                  className={cn("flex flex-col items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors hover:bg-muted",
                    mounted && theme === v && "border-primary bg-primary/10 text-primary")}>
                  <Icon className="size-5" /> {l}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Currency</Label>
              <NativeSelect value={settings.currency} onChange={(e) => patch({ currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.name} — {c.code}</option>)}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">Preview: {formatMoney(1234567.89, settings.currency)}</p>
            </div>
            <div className="grid gap-1.5">
              <Label>Week starts on</Label>
              <NativeSelect value={String(settings.week_start)} onChange={(e) => patch({ week_start: Number(e.target.value) as 0 | 1 })}>
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
              </NativeSelect>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>Shown when adding a transaction. Deleting one keeps old transactions but clears their method.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {paymentMethods.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl border p-2 pl-3">
                  {editId === p.id ? (
                    <>
                      <Input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editName.trim()) run(() => renamePaymentMethod(p.id, editName.trim()), "Renamed").then(() => setEditId(null));
                          if (e.key === "Escape") setEditId(null);
                        }} />
                      <Button size="icon-sm" variant="ghost" aria-label="Save"
                        onClick={() => editName.trim() && run(() => renamePaymentMethod(p.id, editName.trim()), "Renamed").then(() => setEditId(null))}><Check /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setEditId(null)}><X /></Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{p.name}</span>
                      <Button size="icon-sm" variant="ghost" aria-label="Rename" onClick={() => { setEditId(p.id); setEditName(p.name); }}><Pencil /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => setDelPm(p)}><Trash2 className="text-destructive" /></Button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(e) => {
              e.preventDefault();
              if (!newPm.trim()) return;
              run(() => addPaymentMethod(newPm.trim()), "Payment method added").then(() => setNewPm(""));
            }}>
              <Input placeholder="New payment method (e.g. GCash)" value={newPm} onChange={(e) => setNewPm(e.target.value)} />
              <Button type="submit"><Plus /> Add</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-destructive/40 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><TriangleAlert className="size-4" /> Danger zone</CardTitle>
            <CardDescription>Permanently removes all transactions, day journals, budgets and recurring items. Categories, payment methods and settings are kept.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setWipe(true)}><Trash2 /> Delete all data</Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!delPm}
        onOpenChange={(o) => !o && setDelPm(null)}
        title={`Delete “${delPm?.name}”?`}
        description="Existing transactions keep working but will show no payment method."
        onConfirm={() => delPm ? run(() => deletePaymentMethod(delPm.id), "Deleted") : undefined}
      />
      <ConfirmDialog
        open={wipe}
        onOpenChange={setWipe}
        title="Delete ALL data?"
        description="This cannot be undone. Every transaction, journal entry, budget and recurring item will be permanently erased."
        confirmLabel="Yes, delete everything"
        onConfirm={() => run(deleteAllData, "All data deleted")}
      />
    </>
  );
}
