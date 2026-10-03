"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle, BarChart3, CalendarDays, Database, LayoutDashboard, MoreHorizontal, Plus,
  Repeat, Settings, Tags, Target, Wallet,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAppData } from "@/hooks/use-app-data";
import { useTransactionDialog } from "@/hooks/use-transaction-dialog";
import { isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/budgets", label: "Budgets", icon: Target },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/data", label: "Import / Export", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];
const MOBILE_MAIN = NAV.slice(0, 4);
const MOBILE_MORE = NAV.slice(4);

const isActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(href + "/");

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { open } = useTransactionDialog();
  const { error } = useAppData();
  const [more, setMore] = useState(false);

  return (
    <div className="min-h-dvh">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar px-3 py-5 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30">
            <Wallet className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Spendly</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(path, n.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => open()}
          className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 transition-transform hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="size-4" /> Add transaction
        </button>
      </aside>

      <main className="md:pl-60">
        <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          {!isSupabaseConfigured && <SetupBanner />}
          {error && (
            <div className="mb-4 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium">Couldn&apos;t load your data</p>
                <p className="text-muted-foreground">
                  {error}. Check your Supabase keys and that you ran <code>supabase/schema.sql</code>.
                </p>
              </div>
            </div>
          )}
          <div key={path} className="page-in">{children}</div>
        </div>
      </main>

      {/* floating quick add */}
      <button
        onClick={() => open()}
        aria-label="Quick add transaction"
        className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/40 transition-transform hover:scale-105 active:scale-95 md:bottom-7 md:right-7"
      >
        <Plus className="size-6" />
      </button>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {MOBILE_MAIN.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
              isActive(path, n.href) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
        <button
          onClick={() => setMore(true)}
          className={cn(
            "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
            MOBILE_MORE.some((n) => isActive(path, n.href)) ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4">
            {MOBILE_MORE.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMore(false)}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm font-medium"
              >
                <n.icon className="size-5 text-primary" />
                {n.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SetupBanner() {
  return (
    <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      <p className="font-semibold">Supabase isn&apos;t connected yet</p>
      <p className="mt-1 text-muted-foreground">
        Fill in <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
        <code>.env.local</code> (or in Vercel → Environment Variables), run{" "}
        <code>supabase/schema.sql</code> in the Supabase SQL Editor, then restart/redeploy. See the README
        for the full steps.
      </p>
    </div>
  );
}
