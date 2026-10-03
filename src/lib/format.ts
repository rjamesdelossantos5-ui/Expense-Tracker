import { format, parse, parseISO } from "date-fns";

export const ymd = (d: Date) => format(d, "yyyy-MM-dd");
export const parseYmd = (s: string) => parse(s, "yyyy-MM-dd", new Date());
export const todayYmd = () => ymd(new Date());
export const nowHm = () => format(new Date(), "HH:mm");
export const monthKey = (d: Date) => format(d, "yyyy-MM");
export const hm = (t: string) => (t ? t.slice(0, 5) : "");
export const prettyTime = (t: string) =>
  t ? format(parse(t.slice(0, 5), "HH:mm", new Date()), "h:mm a") : "";
export const prettyDate = (s: string) => format(parseYmd(s), "EEE, MMM d, yyyy");
export const prettyTs = (s: string) => format(parseISO(s), "MMM d, yyyy h:mm a");

export const CURRENCIES: { code: string; name: string }[] = [
  { code: "PHP", name: "Philippine Peso (₱)" },
  { code: "USD", name: "US Dollar ($)" },
  { code: "EUR", name: "Euro (€)" },
  { code: "GBP", name: "British Pound (£)" },
  { code: "JPY", name: "Japanese Yen (¥)" },
  { code: "KRW", name: "South Korean Won (₩)" },
  { code: "INR", name: "Indian Rupee (₹)" },
  { code: "CNY", name: "Chinese Yuan (¥)" },
  { code: "AUD", name: "Australian Dollar (A$)" },
  { code: "CAD", name: "Canadian Dollar (C$)" },
  { code: "SGD", name: "Singapore Dollar (S$)" },
  { code: "AED", name: "UAE Dirham (AED)" },
];

const cache = new Map<string, Intl.NumberFormat>();
function nf(currency: string) {
  let f = cache.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-US", { style: "currency", currency });
    cache.set(currency, f);
  }
  return f;
}
export const formatMoney = (n: number, currency = "PHP") => nf(currency).format(n);

const compactNf = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
export const formatCompact = (n: number) => compactNf.format(n);

export const currencySymbol = (currency: string) =>
  nf(currency).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;

export const parseTags = (s: string) =>
  Array.from(
    new Set(
      s
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
