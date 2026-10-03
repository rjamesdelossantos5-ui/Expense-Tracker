"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useAppData } from "@/hooks/use-app-data";
import { formatCompact } from "@/lib/format";

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };

function TipBox({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      {label != null && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 tabular-nums">
          <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.color ?? p.fill }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold">{fmt(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

export function SpendAreaChart({ data }: { data: { label: string; amount: number }[] }) {
  const { fmt } = useAppData();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={52} />
        <Tooltip content={<TipBox fmt={fmt} />} />
        <Area type="monotone" dataKey="amount" name="Spent" stroke="#6366f1" strokeWidth={2.5} fill="url(#spendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface Slice { name: string; value: number; color: string }

export function CategoryDonut({ data, height = 220, legend = true }: { data: Slice[]; height?: number; legend?: boolean }) {
  const { fmt } = useAppData();
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="relative w-full max-w-[220px] shrink-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={2} strokeWidth={0}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<TipBox fmt={fmt} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">Total</span>
          <span className="text-sm font-semibold tabular-nums">{fmt(total)}</span>
        </div>
      </div>
      {legend && (
        <ul className="w-full min-w-0 flex-1 space-y-1.5 text-sm">
          {data.slice(0, 8).map((d) => (
            <li key={d.name} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate">{d.name}</span>
              <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
              <span className="w-24 shrink-0 text-right font-medium tabular-nums">{fmt(d.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MonthBars({ data }: { data: { label: string; amount: number }[] }) {
  const { fmt } = useAppData();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={52} />
        <Tooltip content={<TipBox fmt={fmt} />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        <Bar dataKey="amount" name="Spent" fill="#6366f1" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CompareBars({
  data, aLabel, bLabel,
}: { data: { name: string; a: number; b: number; color: string }[]; aLabel: string; bLabel: string }) {
  const { fmt } = useAppData();
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={formatCompact} />
        <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={92} />
        <Tooltip content={<TipBox fmt={fmt} />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="a" name={aLabel} fill="#6366f1" radius={[0, 4, 4, 0]} />
        <Bar dataKey="b" name={bLabel} fill="#f59e0b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
