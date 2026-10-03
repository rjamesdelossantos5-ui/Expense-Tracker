"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common";
import { useAppData } from "@/hooks/use-app-data";
import { CSV_HEADERS, download, parseCsv, toCsv } from "@/lib/csv";
import {
  addPaymentMethod, getTransactionsRange, insertTransactions, loadReference, upsertCategory,
} from "@/lib/db";
import { hm, parseTags, todayYmd } from "@/lib/format";
import { COLOR_CHOICES } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { TransactionInput, TxType } from "@/types";

interface ParsedRow {
  line: number;
  date: string;
  time: string;
  type: TxType;
  amount: number;
  category: string;
  payment: string;
  tags: string[];
  note: string;
  error?: string;
}

function normDate(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) {
    const [y, m, d] = t.split("-").map(Number);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // m/d/yyyy
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(t);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return null;
}

export default function DataPage() {
  const { categories, paymentMethods, catById, pmById, reloadReference, notifyChange } = useAppData();

  /* ---------- export ---------- */
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      const rows = await getTransactionsRange(from || "1900-01-01", to || "2999-12-31");
      if (!rows.length) return toast.info("No transactions in that range");
      const csv = toCsv(
        rows.reverse().map((t) => [
          t.date, hm(t.time), t.type, t.amount, catById(t.category_id)?.name ?? "",
          pmById(t.payment_method_id)?.name ?? "", t.tags.join(" "), t.note,
        ])
      );
      download(`transactions-${from || "all"}${to ? `_to_${to}` : ""}.csv`, csv);
      toast.success(`Exported ${rows.length} transactions`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  /* ---------- import ---------- */
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const table = parseCsv(await file.text());
    if (table.length < 2) {
      setParsed(null);
      return toast.error("That file has no data rows");
    }
    const header = table[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
    const idx = (name: string) => header.indexOf(name);
    if (idx("date") < 0 || idx("amount") < 0) {
      setParsed(null);
      return toast.error(`Missing required columns. Expected: ${CSV_HEADERS.join(", ")} (date and amount are required)`);
    }
    const get = (r: string[], n: string) => (idx(n) >= 0 ? (r[idx(n)] ?? "").trim() : "");
    const rows: ParsedRow[] = table.slice(1).map((r, i) => {
      const date = normDate(get(r, "date"));
      const rawAmt = Number(get(r, "amount").replace(/[^0-9.\-]/g, ""));
      const typeRaw = get(r, "type").toLowerCase();
      const type: TxType = typeRaw === "income" ? "income" : "expense";
      const row: ParsedRow = {
        line: i + 2, date: date ?? "", time: hm(get(r, "time")) || "00:00", type,
        amount: Math.abs(rawAmt), category: get(r, "category"),
        payment: get(r, "payment_method") || get(r, "payment"),
        tags: parseTags(get(r, "tags")), note: get(r, "note"),
      };
      if (!date) row.error = "Invalid date";
      else if (!rawAmt || isNaN(rawAmt)) row.error = "Invalid amount";
      return row;
    });
    setParsed(rows);
  }

  const summary = useMemo(() => {
    if (!parsed) return null;
    const ok = parsed.filter((r) => !r.error);
    return { ok: ok.length, bad: parsed.length - ok.length };
  }, [parsed]);

  async function runImport() {
    if (!parsed) return;
    const ok = parsed.filter((r) => !r.error);
    if (!ok.length) return;
    setImporting(true);
    try {
      // create any categories / payment methods that don't exist yet
      const catKey = (n: string, t: TxType) => `${t}:${n.toLowerCase()}`;
      const catMap = new Map(categories.map((c) => [catKey(c.name, c.type), c.id]));
      const need = new Map<string, { name: string; type: TxType }>();
      ok.forEach((r) => {
        if (r.category && !catMap.has(catKey(r.category, r.type))) need.set(catKey(r.category, r.type), { name: r.category, type: r.type });
      });
      let i = 0;
      for (const n of need.values()) {
        await upsertCategory({ name: n.name, type: n.type, color: COLOR_CHOICES[(i++ * 3) % COLOR_CHOICES.length], icon: "tag" });
      }
      const pmNeed = new Set<string>();
      const pmKnown = new Set(paymentMethods.map((p) => p.name.toLowerCase()));
      ok.forEach((r) => { if (r.payment && !pmKnown.has(r.payment.toLowerCase())) pmNeed.add(r.payment); });
      for (const n of pmNeed) await addPaymentMethod(n);

      let cats = categories, pms = paymentMethods;
      if (need.size || pmNeed.size) {
        const fresh = await loadReference();
        cats = fresh.categories;
        pms = fresh.paymentMethods;
      }
      const cm = new Map(cats.map((c) => [catKey(c.name, c.type), c.id]));
      const pm = new Map(pms.map((p) => [p.name.toLowerCase(), p.id]));

      const payload: TransactionInput[] = ok.map((r) => ({
        type: r.type, amount: r.amount,
        category_id: r.category ? cm.get(catKey(r.category, r.type)) ?? null : null,
        payment_method_id: r.payment ? pm.get(r.payment.toLowerCase()) ?? null : null,
        date: r.date, time: `${r.time}:00`, note: r.note, tags: r.tags,
      }));
      await insertTransactions(payload);
      await reloadReference();
      notifyChange();
      toast.success(`Imported ${payload.length} transactions`);
      setParsed(null);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader title="Import / Export" description="Back up your data or bring it in from a spreadsheet." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Download className="size-4 text-primary" /> Export CSV</CardTitle>
            <CardDescription>Leave dates empty to export everything.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="grid gap-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <Button onClick={exportCsv} disabled={exporting}>
              {exporting ? <Loader2 className="animate-spin" /> : <Download />} Download CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="size-4 text-primary" /> Import CSV</CardTitle>
            <CardDescription>
              Columns: <code>{CSV_HEADERS.join(", ")}</code>. Only date and amount are required. Unknown categories and payment methods are created for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUp /> {fileName || "Choose CSV file"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Tip: export first to see the exact format. Today is {todayYmd()}.
            </p>
          </CardContent>
        </Card>
      </div>

      {parsed && summary && (
        <Card className="mt-4">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {summary.ok} ready to import{summary.bad > 0 && <>, <span className="text-destructive">{summary.bad} will be skipped</span></>}. Showing the first 50 rows.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setParsed(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}>Cancel</Button>
              <Button onClick={runImport} disabled={importing || !summary.ok}>
                {importing && <Loader2 className="animate-spin" />} Import {summary.ok} rows
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {["#", "Date", "Time", "Type", "Amount", "Category", "Payment", "Tags", "Note", ""].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 50).map((r) => (
                  <tr key={r.line} className={cn("border-b last:border-0", r.error && "bg-destructive/5")}>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.line}</td>
                    <td className="px-2 py-1.5">{r.date || "—"}</td>
                    <td className="px-2 py-1.5">{r.time}</td>
                    <td className="px-2 py-1.5 capitalize">{r.type}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.amount}</td>
                    <td className="px-2 py-1.5">{r.category || "—"}</td>
                    <td className="px-2 py-1.5">{r.payment || "—"}</td>
                    <td className="px-2 py-1.5">{r.tags.join(", ")}</td>
                    <td className="max-w-48 truncate px-2 py-1.5">{r.note}</td>
                    <td className="px-2 py-1.5">{r.error ? <Badge variant="destructive">{r.error}</Badge> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
