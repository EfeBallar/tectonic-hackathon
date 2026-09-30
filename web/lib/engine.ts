// The deterministic finance engine. CODE CALCULATES, the LLM only explains.
// Pure functions, no I/O: runs in the browser (instant UI) and in API routes (LLM grounding).

import type {
  Analysis,
  Category,
  CategoryStat,
  FinState,
  Insight,
  ProjectionPoint,
  ProposedAction,
  Recurring,
  ScheduledPayment,
  Transaction,
} from "./types";
import {
  CATEGORY_LABEL,
  addDays,
  diffDays,
  eur,
  eur0,
  fmtDate,
  nextDayOfMonth,
  relDays,
  round2,
  roundDownTo,
  roundUpTo,
} from "./util";

export const VARIABLE: Category[] = [
  "groceries",
  "eating_out",
  "transport",
  "shopping",
  "leisure",
  "health",
  "other",
];

const SEVERITY_RANK = { critical: 0, warning: 1, positive: 2, info: 3 } as const;

const COUNTRY: Record<string, string> = {
  LT: "Lithuania", NL: "the Netherlands", FR: "France", DE: "Germany", GB: "the UK", US: "the US", CN: "China", NG: "Nigeria", RU: "Russia",
};

const NOT_USED = [
  "Other customers' data",
  "Browsing or location history",
  "Accounts at other banks",
];

// ---------------------------------------------------------------------------
// Recurring payments
// ---------------------------------------------------------------------------

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function detectRecurring(s: FinState): Recurring[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of s.transactions) {
    if (t.amount >= 0) continue;
    if (VARIABLE.includes(t.category) || t.category === "transfer") continue;
    const g = groups.get(t.merchant) ?? [];
    g.push(t);
    groups.set(t.merchant, g);
  }
  const out: Recurring[] = [];
  for (const [merchant, txs] of groups) {
    if (txs.length < 2) continue;
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const intervals = sorted.slice(1).map((t, i) => diffDays(t.date, sorted[i].date));
    const interval = Math.round(median(intervals));
    if (interval < 26 || interval > 35) continue;
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    let nextDate = addDays(last.date, interval);
    if (diffDays(nextDate, s.today) <= 0) nextDate = addDays(s.today, 1); // overdue -> expect tomorrow
    out.push({
      merchant,
      category: last.category,
      lastAmount: -last.amount,
      prevAmount: -prev.amount,
      lastDate: last.date,
      intervalDays: interval,
      nextDate,
      count: sorted.length,
    });
  }
  return out;
}

function incomeInfo(s: FinState) {
  const inc = s.transactions.filter((t) => t.category === "income" && t.merchant === s.profile.employer);
  const last = inc[0];
  return { amount: last ? last.amount : 0 };
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/** Payments that look like fraud and haven't been confirmed. Kept out of "normal spending" stats. */
export function suspiciousIds(s: FinState): string[] {
  return s.transactions
    .filter((t) => t.amount < 0 && t.country && t.country !== "BE" && !s.confirmedTx.includes(t.id))
    .filter((t) => !s.transactions.some((o) => o.id !== t.id && o.merchant === t.merchant))
    .map((t) => t.id)
    .concat(s.reportedTx);
}

export function dailyDiscretionary(s: FinState): number {
  const skip = suspiciousIds(s);
  const total = s.transactions
    .filter((t) => t.amount < 0 && VARIABLE.includes(t.category))
    .filter((t) => !skip.includes(t.id))
    .filter((t) => {
      const d = diffDays(s.today, t.date);
      return d >= 0 && d < 60;
    })
    .reduce((a, t) => a - t.amount, 0);
  return round2(total / 60);
}

export interface ExtraFlow {
  date: string;
  amount: number; // positive = outflow
  label: string;
}

export function project(s: FinState, horizonDays: number, extra: ExtraFlow[] = []): ProjectionPoint[] {
  const recurring = detectRecurring(s);
  const income = incomeInfo(s);
  const daily = dailyDiscretionary(s);

  const events = new Map<string, { label: string; amount: number }[]>();
  const push = (date: string, label: string, amount: number) => {
    const d = diffDays(date, s.today);
    if (d < 1 || d > horizonDays) return;
    const arr = events.get(date) ?? [];
    arr.push({ label, amount });
    events.set(date, arr);
  };

  for (const r of recurring) {
    let d = r.nextDate;
    while (diffDays(d, s.today) <= horizonDays) {
      push(d, r.merchant, -r.lastAmount);
      d = addDays(d, r.intervalDays);
    }
  }
  for (const p of s.scheduled) push(p.date, p.label, -p.amount);
  for (const e of extra) push(e.date, e.label, -e.amount);
  let pd = nextDayOfMonth(s.today, s.profile.paydayDay);
  while (diffDays(pd, s.today) <= horizonDays) {
    push(pd, s.profile.incomeLabel, income.amount);
    pd = nextDayOfMonth(pd, s.profile.paydayDay);
  }

  const points: ProjectionPoint[] = [];
  let bal = s.checking;
  points.push({ day: 0, date: s.today, balance: round2(bal), events: [] });
  for (let d = 1; d <= horizonDays; d++) {
    const date = addDays(s.today, d);
    const ev = events.get(date) ?? [];
    bal = bal - daily + ev.reduce((a, e) => a + e.amount, 0);
    points.push({ day: d, date, balance: round2(bal), events: ev });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Category stats
// ---------------------------------------------------------------------------

export function categoryStats(s: FinState): CategoryStat[] {
  const out: CategoryStat[] = [];
  const skip = suspiciousIds(s);
  for (const cat of VARIABLE) {
    const txs = s.transactions.filter(
      (t) => t.category === cat && t.amount < 0 && !skip.includes(t.id),
    );
    const recent = txs.filter((t) => {
      const d = diffDays(s.today, t.date);
      return d >= 0 && d < 30;
    });
    const before = txs.filter((t) => {
      const d = diffDays(s.today, t.date);
      return d >= 30 && d < 90;
    });
    const last30 = round2(recent.reduce((a, t) => a - t.amount, 0));
    const usual30 = round2(before.reduce((a, t) => a - t.amount, 0) / 2);
    const byMerchant = new Map<string, { total: number; count: number }>();
    for (const t of recent) {
      const m = byMerchant.get(t.merchant) ?? { total: 0, count: 0 };
      m.total += -t.amount;
      m.count += 1;
      byMerchant.set(t.merchant, m);
    }
    const topMerchants = [...byMerchant.entries()]
      .map(([merchant, v]) => ({ merchant, total: round2(v.total), count: v.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
    out.push({
      category: cat,
      last30,
      usual30,
      diff: round2(last30 - usual30),
      pct: usual30 > 0 ? Math.round(((last30 - usual30) / usual30) * 100) : 0,
      countLast30: recent.length,
      countUsual30: Math.round(before.length / 2),
      topMerchants,
    });
  }
  return out.sort((a, b) => b.last30 - a.last30);
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

function suspiciousInsights(s: FinState): Insight[] {
  const cardTx = s.transactions.filter(
    (t) => t.amount < 0 && (t.channel === "card" || t.channel === "online"),
  );
  const typical = median(cardTx.map((t) => -t.amount)) || 20;
  const out: Insight[] = [];
  for (const t of cardTx) {
    const age = diffDays(s.today, t.date);
    if (age < 0 || age > 3) continue;
    if (s.reportedTx.includes(t.id) || s.confirmedTx.includes(t.id)) continue;
    const seenBefore = s.transactions.some((o) => o.id !== t.id && o.merchant === t.merchant);
    const hour = t.time ? Number(t.time.slice(0, 2)) : 12;
    const reasons: string[] = [];
    const where = t.country ? COUNTRY[t.country] ?? t.country : "";
    if (t.country && t.country !== "BE") reasons.push(`paid from ${where}`);
    if (!seenBefore) reasons.push("first time at this merchant");
    if (-t.amount > typical * 4) reasons.push(`${Math.round(-t.amount / typical)}× your typical card payment`);
    if (hour < 6) reasons.push(`at ${t.time}, when you're usually asleep`);
    if (reasons.length < 3) continue;
    const times = Math.round(-t.amount / typical);
    out.push({
      id: `fraud_${t.id}`,
      kind: "suspicious_payment",
      severity: "critical",
      title: `Did you make this payment? ${eur(-t.amount)} at ${t.merchant}`,
      summary: `An ${t.channel} payment ${t.country && t.country !== "BE" ? `from ${where} ` : ""}at ${t.time ?? "an odd hour"}. You've never paid this merchant before and it's ${times}× your typical card payment.`,
      facts: {
        merchant: t.merchant,
        amount: -t.amount,
        date: fmtDate(t.date),
        time: t.time ?? "",
        country: where || "Belgium",
        typical_card_payment: round2(typical),
        times_typical: times,
        reasons: reasons.join("; "),
      },
      evidence: [t.id],
      dataUsed: [
        "This payment's merchant, amount, time and country",
        "Your usual card payments (last 90 days)",
        "Merchants you've paid before",
      ],
      dataNotUsed: NOT_USED,
      actions: [
        { type: "FREEZE_CARD", label: "Not me: freeze card", params: { txId: t.id }, primary: true },
        { type: "MARK_AS_MINE", label: "Yes, that was me", params: { txId: t.id } },
      ],
    });
  }
  return out;
}

function crunchInsight(s: FinState, a: Omit<Analysis, "insights">): Insight | null {
  const buffer = s.profile.bufferTarget;
  if (a.lowest.balance >= buffer) return null;
  const shortfall = round2(buffer - a.lowest.balance);
  const bills = a.upcoming.reduce((x, p) => x + p.amount, 0);
  const biggest = [...a.upcoming].sort((x, y) => y.amount - x.amount)[0];
  const intoRed = a.lowest.balance < 0;
  const topUp = roundUpTo(shortfall + 40, 50);
  const spike = [...a.categories].sort((x, y) => y.diff - x.diff).find((c) => c.diff > 40 && c.pct >= 25);

  const actions: ProposedAction[] = [];
  if (s.savings >= topUp) {
    actions.push({
      type: "TRANSFER_FROM_SAVINGS",
      label: `Move ${eur0(topUp)} from savings`,
      params: { amount: topUp },
      primary: true,
    });
  }
  if (spike) {
    const limit = roundUpTo(spike.usual30, 10);
    actions.push({
      type: "CREATE_BUDGET",
      label: `Cap ${CATEGORY_LABEL[spike.category].toLowerCase()} at ${eur0(limit)}`,
      params: { category: spike.category, limit },
    });
  }
  actions.push({ type: "DISMISS", label: "Not now", params: { insightId: "crunch" } });

  const lead = biggest
    ? `${biggest.label} (${eur0(biggest.amount)}) lands ${relDays(diffDays(biggest.date, s.today))}, with ${eur0(bills)} in bills before payday. `
    : "";
  return {
    id: "crunch",
    kind: "cash_crunch",
    severity: intoRed ? "critical" : "warning",
    title: intoRed
      ? `Heads up: you're heading ${eur0(-a.lowest.balance)} into the red`
      : `Tight stretch ahead: you'll dip ${eur0(shortfall)} below your buffer`,
    summary: `${lead}At your usual pace you'll bottom out at ${eur0(a.lowest.balance)} on ${fmtDate(a.lowest.date)}, under your ${eur0(buffer)} safety buffer.`,
    facts: {
      balance_now: s.checking,
      bills_before_payday: round2(bills),
      typical_daily_spending: a.dailyDiscretionary,
      lowest_balance: a.lowest.balance,
      lowest_date: fmtDate(a.lowest.date),
      buffer,
      shortfall,
      days_to_payday: a.daysToPayday,
      biggest_bill: biggest?.label ?? "",
      biggest_bill_amount: biggest?.amount ?? 0,
      suggested_top_up: topUp,
      savings_balance: s.savings,
    },
    evidence: [],
    dataUsed: [
      "Your checking balance",
      "Recurring bills we detected in your history",
      "Payments you've scheduled",
      "Your average everyday spending (last 60 days)",
      `Your ${eur0(buffer)} safety buffer (you set this)`,
    ],
    dataNotUsed: NOT_USED,
    actions,
  };
}

function spikeInsights(s: FinState, cats: CategoryStat[]): Insight[] {
  return cats
    .filter((c) => c.diff >= 40 && c.pct >= 25 && c.usual30 >= 20)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 1)
    .map((c): Insight => {
      const label = CATEGORY_LABEL[c.category];
      const limit = roundUpTo(c.usual30 * 1.1, 10);
      const tops = c.topMerchants
        .slice(0, 2)
        .map((m) => `${m.merchant} (${m.count}×, ${eur0(m.total)})`)
        .join(" and ");
      const evidence = s.transactions
        .filter((t) => t.category === c.category && t.amount < 0 && diffDays(s.today, t.date) < 30)
        .map((t) => t.id);
      const facts: Record<string, string | number> = {
        category: label,
        last_30_days: c.last30,
        usual_30_days: c.usual30,
        difference: c.diff,
        percent_up: c.pct,
        payments_last_30_days: c.countLast30,
        payments_usual: c.countUsual30,
        suggested_budget: limit,
      };
      c.topMerchants.forEach((m, i) => {
        facts[`top_merchant_${i + 1}`] = m.merchant;
        facts[`top_merchant_${i + 1}_total`] = m.total;
        facts[`top_merchant_${i + 1}_count`] = m.count;
      });
      return {
        id: `spike_${c.category}`,
        kind: "spending_spike",
        severity: "info",
        title: `${label} is up ${eur0(c.diff)} this month`,
        summary: `${eur0(c.last30)} in the last 30 days vs ${eur0(c.usual30)} usually (${c.countLast30} payments instead of ~${c.countUsual30}). Mostly ${tops}.`,
        facts,
        evidence,
        dataUsed: [
          `Your ${label.toLowerCase()} payments, last 90 days`,
          "Merchant names on those payments",
        ],
        dataNotUsed: NOT_USED,
        actions: [
          {
            type: "CREATE_BUDGET",
            label: `Set a ${eur0(limit)} monthly cap`,
            params: { category: c.category, limit },
            primary: true,
          },
          { type: "SHOW_TRANSACTIONS", label: "See payments", params: { category: c.category } },
          { type: "DISMISS", label: "That's fine", params: { insightId: `spike_${c.category}` } },
        ],
      };
    });
}

function priceInsight(s: FinState, rec: Recurring[]): Insight | null {
  const ups = rec
    .filter((r) => r.lastAmount - r.prevAmount >= 0.9 && (r.lastAmount - r.prevAmount) / r.prevAmount >= 0.05)
    .sort((a, b) => b.lastAmount - b.prevAmount - (a.lastAmount - a.prevAmount));
  if (!ups.length) return null;
  const total = round2(ups.reduce((a, r) => a + r.lastAmount - r.prevAmount, 0));
  const facts: Record<string, string | number> = {
    total_increase_per_month: total,
    total_increase_per_year: round2(total * 12),
  };
  ups.forEach((r, i) => {
    facts[`item_${i + 1}`] = r.merchant;
    facts[`item_${i + 1}_before`] = r.prevAmount;
    facts[`item_${i + 1}_now`] = r.lastAmount;
    facts[`item_${i + 1}_next_charge`] = fmtDate(r.nextDate);
  });
  const list = ups.map((r) => `${r.merchant} ${eur(r.prevAmount)} → ${eur(r.lastAmount)}`).join(", ");
  const firstNext = [...ups].sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0];
  const remindAt = diffDays(firstNext.nextDate, s.today) > 3 ? addDays(firstNext.nextDate, -3) : addDays(s.today, 1);
  return {
    id: "price_increase",
    kind: "price_increase",
    severity: "info",
    title: `Your fixed costs went up ${Number.isInteger(total) ? eur0(total) : eur(total)}/month`,
    summary: `${list}. That's ${eur0(total * 12)} a year if it sticks, and nobody sent you a heads up.`,
    facts,
    evidence: s.transactions.filter((t) => ups.some((u) => u.merchant === t.merchant)).map((t) => t.id),
    dataUsed: ["Recurring payments we detected in your history", "The last two amounts of each"],
    dataNotUsed: NOT_USED,
    actions: [
      {
        type: "CREATE_REMINDER",
        label: `Remind me before ${firstNext.merchant} charges again`,
        params: { label: `Review ${ups.map((u) => u.merchant).join(", ")}`, date: remindAt },
        primary: true,
      },
      { type: "SHOW_TRANSACTIONS", label: "See payments", params: { merchants: ups.map((u) => u.merchant) } },
      { type: "DISMISS", label: "Fine by me", params: { insightId: "price_increase" } },
    ],
  };
}

function idleInsight(s: FinState, a: Omit<Analysis, "insights">): Insight | null {
  const buffer = s.profile.bufferTarget;
  const headroom = a.lowest.balance - buffer;
  if (headroom < 400) return null;
  const amount = roundDownTo(headroom - 100, 50);
  const bills = a.upcoming.reduce((x, p) => x + p.amount, 0);
  return {
    id: "idle_cash",
    kind: "idle_cash",
    severity: "positive",
    title: `${eur0(amount)} is sitting idle in your checking account`,
    summary: `Even after ${eur0(bills)} in upcoming payments and your usual spending, you'll stay ${eur0(headroom)} above your ${eur0(buffer)} buffer until ${fmtDate(a.nextPayday)}. It could be earning interest instead.`,
    facts: {
      suggested_amount: amount,
      headroom: round2(headroom),
      buffer,
      bills_before_income: round2(bills),
      next_income_date: fmtDate(a.nextPayday),
      lowest_balance: a.lowest.balance,
    },
    evidence: [],
    dataUsed: [
      "Your checking balance",
      "Upcoming and recurring payments",
      "Your average everyday spending (last 60 days)",
      `Your ${eur0(buffer)} safety buffer`,
    ],
    dataNotUsed: NOT_USED,
    actions: [
      { type: "MOVE_TO_SAVINGS", label: `Move ${eur0(amount)} to savings`, params: { amount }, primary: true },
      { type: "DISMISS", label: "Keep it here", params: { insightId: "idle_cash" } },
    ],
  };
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export function analyze(s: FinState): Analysis {
  const nextPayday = nextDayOfMonth(s.today, s.profile.paydayDay);
  const daysToPayday = diffDays(nextPayday, s.today);
  const horizon = daysToPayday + 6;
  const projection = project(s, horizon);
  const recurring = detectRecurring(s);
  const categories = categoryStats(s);
  const daily = dailyDiscretionary(s);

  const prePayday = projection.filter((p) => p.day < Math.max(daysToPayday, 1));
  const lowestP = prePayday.reduce((m, p) => (p.balance < m.balance ? p : m), prePayday[0]);
  const lowest = { day: lowestP.day, date: lowestP.date, balance: lowestP.balance };

  const upcoming: ScheduledPayment[] = [];
  for (const p of projection) {
    if (p.day < 1 || p.day >= daysToPayday) continue;
    for (const e of p.events) {
      if (e.amount >= 0) continue;
      const sched = s.scheduled.find((x) => x.label === e.label && x.date === p.date);
      const rec = recurring.find((r) => r.merchant === e.label);
      upcoming.push({
        id: `${p.date}_${e.label}`,
        date: p.date,
        label: e.label,
        amount: -e.amount,
        category: sched?.category ?? rec?.category ?? "other",
        source: sched ? "scheduled" : "predicted",
      });
    }
  }

  const billsToLowest = upcoming.filter((u) => diffDays(u.date, s.today) <= lowest.day).reduce((a, u) => a + u.amount, 0);
  const safeToSpend = Math.max(0, round2(lowest.balance - s.profile.bufferTarget));
  const safeToSpendBreakdown = [
    { label: "In your account now", amount: s.checking },
    { label: "Bills before payday", amount: -round2(billsToLowest) },
    { label: `Everyday spending (${lowest.day} days × ${eur(daily)})`, amount: -round2(daily * lowest.day) },
    { label: "Your safety buffer", amount: -s.profile.bufferTarget },
  ];

  const base = {
    nextPayday,
    daysToPayday,
    expectedIncome: incomeInfo(s).amount,
    dailyDiscretionary: daily,
    upcoming,
    projection,
    lowest,
    safeToSpend,
    safeToSpendBreakdown,
    recurring,
    categories,
  };

  const insights = [
    ...suspiciousInsights(s),
    crunchInsight(s, base),
    ...spikeInsights(s, categories),
    priceInsight(s, recurring),
    idleInsight(s, base),
  ]
    .filter((x): x is Insight => !!x && !s.dismissed.includes(x.id))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return { ...base, insights };
}
