import type { Category } from "./types";

// ---------- dates (all yyyy-mm-dd strings, local, no timezone drama) ----------

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12); // noon avoids DST edge cases
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(a: string, b: string): number {
  // a - b in whole days
  return Math.round((fromISO(a).getTime() - fromISO(b).getTime()) / 86_400_000);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function dayOfMonth(iso: string): number {
  return fromISO(iso).getDate();
}

/** Next date (strictly after `from`) that falls on day-of-month `day` (clamped to month length). */
export function nextDayOfMonth(from: string, day: number): string {
  const d = fromISO(from);
  for (let i = 0; i < 3; i++) {
    const candidate = new Date(d.getFullYear(), d.getMonth() + i, 1, 12);
    const len = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
    candidate.setDate(Math.min(day, len));
    const iso = toISO(candidate);
    if (diffDays(iso, from) > 0) return iso;
  }
  return addDays(from, 30);
}

// ---------- formatting ----------

const eurFmt = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const eurFmt0 = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function eur(n: number, opts: { decimals?: boolean; sign?: boolean } = {}): string {
  const s = (opts.decimals === false ? eurFmt0 : eurFmt).format(Math.abs(n));
  if (n < 0) return `-${s}`;
  if (opts.sign && n > 0) return `+${s}`;
  return s;
}

export function eur0(n: number): string {
  return eur(Math.round(n), { decimals: false });
}

export function fmtDate(iso: string, style: "short" | "long" = "short"): string {
  const d = fromISO(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: "short",
  });
}

export function relDays(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n < 0) return `${-n} days ago`;
  return `in ${n} days`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function roundUpTo(n: number, step: number): number {
  return Math.ceil(n / step) * step;
}

export function roundDownTo(n: number, step: number): number {
  return Math.floor(n / step) * step;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  income: "Income",
  rent: "Rent",
  groceries: "Groceries",
  eating_out: "Eating out & delivery",
  energy: "Energy",
  telecom: "Phone & internet",
  subscriptions: "Subscriptions",
  transport: "Transport",
  shopping: "Shopping",
  leisure: "Going out & leisure",
  health: "Health",
  insurance: "Insurance",
  taxes: "Taxes & contributions",
  software: "Software & tools",
  transfer: "Transfers",
  other: "Other",
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  income: "💶",
  rent: "🏠",
  groceries: "🛒",
  eating_out: "🍜",
  energy: "⚡",
  telecom: "📶",
  subscriptions: "🔁",
  transport: "🚆",
  shopping: "🛍️",
  leisure: "🎟️",
  health: "💊",
  insurance: "🛡️",
  taxes: "🧾",
  software: "💻",
  transfer: "↔️",
  other: "•",
};
