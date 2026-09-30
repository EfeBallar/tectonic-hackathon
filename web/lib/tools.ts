// Deterministic "tools" the assistant can call. Given an intent + the customer's state,
// return FACTS (numbers computed by code), allowed ACTIONS, an optional UI card, and a
// template sentence that works with zero LLM.

import { analyze, project } from "./engine";
import type { Category, FinState, Intent, ProposedAction, ToolResult } from "./types";
import { CATEGORY_LABEL, addDays, diffDays, eur0, fmtDate, fromISO, nextDayOfMonth, round2, roundUpTo, toISO } from "./util";

// ---------------------------------------------------------------------------
// Regex intent parser (fallback when there is no LLM, or it fails)
// ---------------------------------------------------------------------------

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const CATEGORY_WORDS: [RegExp, Category][] = [
  [/food|eat|restaurant|delivery|deliveroo|uber ?eats|takeaway|lunch|dinner/i, "eating_out"],
  [/grocer|supermarket|colruyt|delhaize|aldi|lidl/i, "groceries"],
  [/shop|cloth|zalando|bol\.com|amazon/i, "shopping"],
  [/train|bus|transport|fuel|gas|petrol|nmbs|lijn/i, "transport"],
  [/bar|party|going out|drinks|cinema|leisure|concert/i, "leisure"],
];

export function parseAmount(q: string): number | undefined {
  const m =
    q.match(/€\s?(\d+(?:[.,]\d{1,2})?)/) ||
    q.match(/(\d+(?:[.,]\d{1,2})?)\s?(?:€|eur|euro|euros)\b/i) ||
    q.match(/\b(\d{2,6})\b/);
  if (!m) return undefined;
  return Number(m[1].replace(",", "."));
}

export function parseWhen(q: string, today: string): string | undefined {
  const s = q.toLowerCase();
  if (/tomorrow/.test(s)) return addDays(today, 1);
  if (/this weekend|weekend/.test(s)) {
    const d = fromISO(today);
    const toSat = (6 - d.getDay() + 7) % 7 || 7;
    return addDays(today, toSat);
  }
  if (/next week/.test(s)) return addDays(today, 7);
  if (/next month/.test(s)) {
    const d = fromISO(today);
    return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 15, 12));
  }
  const inN = s.match(/in (\d+) (day|week|month)s?/);
  if (inN) {
    const n = Number(inN[1]);
    return addDays(today, inN[2] === "day" ? n : inN[2] === "week" ? n * 7 : n * 30);
  }
  const mi = MONTHS.findIndex((m) => s.includes(m) || s.includes(m.slice(0, 3) + " "));
  if (mi >= 0) {
    const d = fromISO(today);
    let y = d.getFullYear();
    if (mi < d.getMonth()) y++;
    const dayM = s.match(new RegExp(`(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s*(?:of\\s*)?${MONTHS[mi].slice(0, 3)}`)) || s.match(new RegExp(`${MONTHS[mi].slice(0, 3)}\\w*\\s*(\\d{1,2})`));
    return toISO(new Date(y, mi, dayM ? Number(dayM[1]) : 15, 12));
  }
  return undefined;
}

function parseLabel(q: string): string | undefined {
  const trip = q.match(/\b(trip|holiday|weekend|vacation|flight|city ?trip)s?\s+(?:away\s+)?to\s+([A-Z][\w-]+)/i);
  if (trip) return `${trip[1].toLowerCase()} to ${trip[2][0].toUpperCase()}${trip[2].slice(1)}`;
  const m = q.match(/\b(?:a|an|the|my)\s+(?:€?\d+[.,]?\d*\s?(?:€|eur|euro)?\s+)?([a-zA-Z][\w\s'-]{2,30}?)(?:\s+(?:to|in|next|this|for|on|by)\b|\?|$)/i);
  return m ? m[1].trim() : undefined;
}

export function parseIntentRegex(q: string, today: string, last?: Intent): Intent {
  const s = q.toLowerCase();
  const amount = parseAmount(q);
  // follow-up like "and next month?" / "what about in December" after an affordability answer
  if (last?.kind === "affordability" && !amount && (/\b(it|that|instead|then|what about|and)\b/.test(s) || /afford/.test(s))) {
    const date = parseWhen(q, today);
    if (date) return { ...last, date };
  }
  if (/afford|can i (buy|spend|pay|go|get|book)|enough (money|for)|budget for|kan ik/.test(s) && amount) {
    return { kind: "affordability", amount, date: parseWhen(q, today), label: parseLabel(q) };
  }
  if (/(move|put|transfer|save|stash|park)\b/.test(s) && amount) {
    const from = /from (my )?savings|to (my )?checking/.test(s);
    return { kind: "move_money", amount, direction: from ? "from_savings" : "to_savings" };
  }
  if (/coming up|upcoming|bills|due|before payday|scheduled/.test(s)) return { kind: "upcoming" };
  if (/why|spent|spend|spending|more than usual|where.*money|breakdown/.test(s)) {
    const cat = CATEGORY_WORDS.find(([re]) => re.test(s))?.[1];
    return { kind: "explain_spending", category: cat };
  }
  if (amount && /\b(trip|buy|ticket|laptop|phone|holiday|vacation|concert|festival)\b/.test(s)) {
    return { kind: "affordability", amount, date: parseWhen(q, today), label: parseLabel(q) };
  }
  return { kind: "general" };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export function affordability(s: FinState, amount: number, date?: string, label?: string): ToolResult {
  const a = analyze(s);
  const when = date && diffDays(date, s.today) >= 0 ? date : addDays(s.today, 3);
  const what = label || "this";
  const days = diffDays(when, s.today);
  // look until the payday AFTER the purchase: that's where the squeeze shows up
  const payAfter = nextDayOfMonth(when, s.profile.paydayDay);
  const horizon = Math.max(diffDays(payAfter, s.today), days + 1);
  const buffer = s.profile.bufferTarget;

  const base = project(s, horizon);
  const withP = project(s, horizon, [{ date: when, amount, label: what }]);
  const lowestFrom = (pts: typeof base) =>
    pts.filter((p) => p.day >= days && p.day < horizon).reduce((m, p) => Math.min(m, p.balance), Infinity);
  const lowWithout = round2(lowestFrom(base));
  const lowWith = round2(lowestFrom(withP));

  const verdict = lowWith >= buffer + 100 ? "comfortable" : lowWith >= 0 ? "tight" : "not_yet";
  const shortfall = round2(Math.max(0, buffer - lowWith));
  const weeks = Math.max(1, Math.floor(days / 7));
  const perWeek = roundUpTo(shortfall / weeks, 5);
  const Label = what[0].toUpperCase() + what.slice(1);
  const goalLabel = label ? Label : "Planned purchase";

  // Alternative: would it fit if they waited until just after payday?
  const afterPayday = addDays(a.nextPayday, 1);
  let waitWorks = false;
  if (verdict !== "comfortable" && diffDays(afterPayday, when) > 0) {
    const pa = nextDayOfMonth(afterPayday, s.profile.paydayDay);
    const h = diffDays(pa, s.today);
    const d = diffDays(afterPayday, s.today);
    const pts = project(s, h, [{ date: afterPayday, amount, label: what }]);
    const low = pts.filter((p) => p.day >= d && p.day < h).reduce((m, p) => Math.min(m, p.balance), Infinity);
    waitWorks = low >= buffer;
  }
  const topUp = roundUpTo(shortfall, 50);
  const savingsCover = s.savings >= topUp;

  const actions: ProposedAction[] = [];
  let plan: string | undefined;
  if (verdict === "comfortable") {
    actions.push({
      type: "CREATE_GOAL",
      label: `Set ${eur0(amount)} aside for it`,
      params: { label: goalLabel, amount, date: when, perWeek: roundUpTo(amount / weeks, 5) },
      primary: true,
    });
  } else if (waitWorks) {
    plan = `If you book it after payday (${fmtDate(afterPayday)}) it fits without touching your buffer.`;
    actions.push({
      type: "CREATE_REMINDER",
      label: `Remind me on ${fmtDate(afterPayday)}`,
      params: { label: `Book ${what}`, date: afterPayday },
      primary: true,
    });
    if (savingsCover)
      actions.push({ type: "TRANSFER_FROM_SAVINGS", label: `Use ${eur0(topUp)} from savings`, params: { amount: topUp } });
  } else if (days >= 14) {
    plan = `Saving ${eur0(perWeek)}/week until ${fmtDate(when)} closes the gap.`;
    actions.push({
      type: "CREATE_GOAL",
      label: `Save ${eur0(perWeek)}/week for it`,
      params: { label: goalLabel, amount, date: when, perWeek },
      primary: true,
    });
  } else if (savingsCover) {
    plan = `You could cover the gap with ${eur0(topUp)} from your savings (${eur0(s.savings)}).`;
    actions.push({ type: "TRANSFER_FROM_SAVINGS", label: `Use ${eur0(topUp)} from savings`, params: { amount: topUp }, primary: true });
  } else {
    plan = `That's a ${eur0(shortfall)} gap, more than you can close before then.`;
  }

  const verdictText =
    verdict === "comfortable"
      ? `Yes, comfortably. After ${what} (${eur0(amount)}) on ${fmtDate(when)}, your lowest point is ${eur0(lowWith)}, still above your ${eur0(buffer)} buffer.`
      : verdict === "tight"
        ? `Technically yes, but it's tight: your balance would bottom out at ${eur0(lowWith)}, ${eur0(shortfall)} under your ${eur0(buffer)} buffer. ${plan ?? ""}`.trim()
        : `Not right now. ${Label} (${eur0(amount)}) on ${fmtDate(when)} would take you to ${eur0(lowWith)} before payday. ${plan ?? ""}`.trim();

  return {
    tool: "affordability",
    facts: {
      purchase: what,
      amount,
      date: fmtDate(when),
      days_until: days,
      lowest_balance_without: lowWithout,
      lowest_balance_with: lowWith,
      buffer,
      shortfall_vs_buffer: shortfall,
      suggested_per_week: perWeek,
      suggested_top_up_from_savings: topUp,
      savings_balance: s.savings,
      fits_if_after_payday: waitWorks ? "yes" : "no",
      date_after_payday: fmtDate(afterPayday),
      verdict,
      next_payday: fmtDate(a.nextPayday),
      expected_income: a.expectedIncome,
      typical_daily_spending: a.dailyDiscretionary,
    },
    actions,
    card: {
      type: "affordability",
      verdict,
      amount,
      label: what,
      date: when,
      rows: [
        { label: "Lowest balance without it", value: lowWithout },
        { label: `Lowest balance with ${what}`, value: lowWith, emphasis: true },
        { label: "Your safety buffer", value: buffer },
      ],
      plan,
    },
    templateText: verdictText,
  };
}

export function explainSpending(s: FinState, category?: Category): ToolResult {
  const a = analyze(s);
  const cats = a.categories.filter((c) => c.last30 > 0);
  const focus = category ? cats.find((c) => c.category === category) : [...cats].sort((x, y) => y.diff - x.diff)[0];
  const total = round2(cats.reduce((x, c) => x + c.last30, 0));
  const usual = round2(cats.reduce((x, c) => x + c.usual30, 0));
  const facts: Record<string, string | number> = {
    everyday_spending_last_30: total,
    everyday_spending_usual_30: usual,
    difference: round2(total - usual),
  };
  cats.slice(0, 6).forEach((c, i) => {
    facts[`cat_${i + 1}`] = CATEGORY_LABEL[c.category];
    facts[`cat_${i + 1}_last_30`] = c.last30;
    facts[`cat_${i + 1}_usual`] = c.usual30;
  });
  if (focus) {
    facts.focus_category = CATEGORY_LABEL[focus.category];
    facts.focus_last_30 = focus.last30;
    facts.focus_usual = focus.usual30;
    facts.focus_difference = focus.diff;
    facts.focus_percent = focus.pct;
    focus.topMerchants.forEach((m, i) => {
      facts[`focus_merchant_${i + 1}`] = m.merchant;
      facts[`focus_merchant_${i + 1}_total`] = m.total;
      facts[`focus_merchant_${i + 1}_count`] = m.count;
    });
  }
  const actions: ProposedAction[] = [];
  if (focus && focus.diff > 20) {
    actions.push({
      type: "CREATE_BUDGET",
      label: `Cap ${CATEGORY_LABEL[focus.category].toLowerCase()} at ${eur0(roundUpTo(focus.usual30 * 1.1, 10))}`,
      params: { category: focus.category, limit: roundUpTo(focus.usual30 * 1.1, 10) },
      primary: true,
    });
    actions.push({ type: "SHOW_TRANSACTIONS", label: "See payments", params: { category: focus.category } });
  }
  const diff = total - usual;
  const text = focus
    ? `You spent ${eur0(total)} on everyday stuff in the last 30 days, ${diff >= 0 ? `${eur0(diff)} more` : `${eur0(-diff)} less`} than usual. The biggest mover is ${CATEGORY_LABEL[focus.category].toLowerCase()}: ${eur0(focus.last30)} vs ${eur0(focus.usual30)} normally${focus.topMerchants[0] ? `, mostly ${focus.topMerchants[0].merchant} (${focus.topMerchants[0].count}×)` : ""}.`
    : `You spent ${eur0(total)} on everyday stuff in the last 30 days.`;
  return {
    tool: "explain_spending",
    facts,
    actions,
    card: {
      type: "breakdown",
      title: "Last 30 days vs usual",
      rows: cats.slice(0, 6).map((c) => ({
        label: CATEGORY_LABEL[c.category],
        value: c.last30,
        note: c.usual30 > 0 ? `${c.diff >= 0 ? "+" : "−"}${eur0(Math.abs(c.diff))} vs usual` : undefined,
      })),
    },
    templateText: text,
  };
}

export function upcomingTool(s: FinState): ToolResult {
  const a = analyze(s);
  const total = round2(a.upcoming.reduce((x, u) => x + u.amount, 0));
  const facts: Record<string, string | number> = {
    bills_before_payday: total,
    count: a.upcoming.length,
    next_payday: fmtDate(a.nextPayday),
    days_to_payday: a.daysToPayday,
    safe_to_spend: a.safeToSpend,
  };
  a.upcoming.forEach((u, i) => {
    facts[`bill_${i + 1}`] = u.label;
    facts[`bill_${i + 1}_amount`] = u.amount;
    facts[`bill_${i + 1}_date`] = fmtDate(u.date);
  });
  return {
    tool: "upcoming",
    facts,
    actions: [],
    card: { type: "upcoming", items: a.upcoming },
    templateText: a.upcoming.length
      ? `${a.upcoming.length} payments totalling ${eur0(total)} before payday on ${fmtDate(a.nextPayday)}. After those and your usual spending you can safely spend ${eur0(a.safeToSpend)}.`
      : `Nothing scheduled before payday on ${fmtDate(a.nextPayday)}. You can safely spend ${eur0(a.safeToSpend)}.`,
  };
}

export function moveMoneyTool(s: FinState, amount: number, direction: "to_savings" | "from_savings"): ToolResult {
  const toSavings = direction === "to_savings";
  const available = toSavings ? s.checking : s.savings;
  const amt = Math.min(amount, Math.max(0, available));
  const after = analyze({
    ...s,
    checking: toSavings ? s.checking - amt : s.checking + amt,
    savings: toSavings ? s.savings + amt : s.savings - amt,
  });
  const before = analyze(s);
  return {
    tool: "move_money",
    facts: {
      amount: amt,
      direction,
      lowest_balance_before: before.lowest.balance,
      lowest_balance_after: after.lowest.balance,
      lowest_date: fmtDate(after.lowest.date),
      buffer: s.profile.bufferTarget,
      next_payday: fmtDate(before.nextPayday),
      safe_to_spend_before: before.safeToSpend,
      safe_to_spend_after: after.safeToSpend,
      checking_now: s.checking,
      savings_now: s.savings,
    },
    actions: [
      {
        type: toSavings ? "MOVE_TO_SAVINGS" : "TRANSFER_FROM_SAVINGS",
        label: toSavings ? `Move ${eur0(amt)} to savings` : `Move ${eur0(amt)} to checking`,
        params: { amount: amt },
        primary: true,
      },
    ],
    templateText:
      toSavings && after.lowest.balance < s.profile.bufferTarget
        ? `I can do that, but heads up: your balance would bottom out at ${eur0(after.lowest.balance)} on ${fmtDate(after.lowest.date)}, below your ${eur0(s.profile.bufferTarget)} buffer${before.lowest.balance < s.profile.bufferTarget ? ` (it's ${eur0(before.lowest.balance)} without the move)` : ""}. Maybe a smaller amount, or wait until payday on ${fmtDate(before.nextPayday)}?`
        : `Sure. Your safe-to-spend goes from ${eur0(before.safeToSpend)} to ${eur0(after.safeToSpend)}. Confirm below and it's done.`,
  };
}

export function generalTool(s: FinState): ToolResult {
  const a = analyze(s);
  return {
    tool: "general",
    facts: {
      checking: s.checking,
      savings: s.savings,
      safe_to_spend: a.safeToSpend,
      next_payday: fmtDate(a.nextPayday),
      days_to_payday: a.daysToPayday,
      open_insights: a.insights.length,
    },
    actions: [],
    templateText: `You've got ${eur0(s.checking)} in checking and can safely spend ${eur0(a.safeToSpend)} until payday on ${fmtDate(a.nextPayday)}. Try asking "can I afford a €300 weekend away next month?" or "why did I spend more this month?"`,
  };
}

export function runTool(s: FinState, intent: Intent): ToolResult {
  switch (intent.kind) {
    case "affordability":
      return affordability(s, intent.amount, intent.date, intent.label);
    case "explain_spending":
      return explainSpending(s, intent.category);
    case "upcoming":
      return upcomingTool(s);
    case "move_money":
      return moveMoneyTool(s, intent.amount, intent.direction);
    default:
      return generalTool(s);
  }
}
