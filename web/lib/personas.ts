// Synthetic customers. Seeded, so every reload gives the exact same story.
// Each persona has a "story" baked in so the insights are demo-worthy out of the box.
// Swap these for the challenge dataset if KBC hands you one (see README).

import { analyze } from "./engine";
import { between, mulberry32, pick } from "./rng";
import type { Category, FinState, Profile, ScheduledPayment, Transaction } from "./types";
import { addDays, dayOfMonth, diffDays, fromISO, round2, toISO } from "./util";

interface FixedSpec {
  merchant: string;
  category: Category;
  amount: number;
  recentAmount?: number; // most recent charge (bakes in a price increase)
  offset: number; // days after payday
  channel?: Transaction["channel"];
}

interface VariableSpec {
  category: Category;
  merchants: string[];
  perWeek: number;
  min: number;
  max: number;
  boost?: { days: number; perWeek: number }; // extra activity in the last N days
}

interface PersonaSpec {
  seed: number;
  profile: Omit<Profile, "paydayDay">;
  emoji: string;
  daysUntilPayday: number;
  income: number;
  savings: number;
  targetHeadroom: number; // lowest projected balance minus buffer. Negative = crunch.
  fixed: FixedSpec[];
  variable: VariableSpec[];
  scheduled: (today: string) => Omit<ScheduledPayment, "id" | "source">[];
}

const SPECS: PersonaSpec[] = [
  {
    seed: 7,
    emoji: "👩‍💻",
    profile: {
      id: "lotte",
      name: "Lotte",
      age: 26,
      blurb: "Junior data analyst, rents a flat in Leuven",
      segment: "young_pro",
      incomeLabel: "Salary",
      employer: "Brightloop NV",
      bufferTarget: 500,
    },
    daysUntilPayday: 11,
    income: 2780,
    savings: 4300,
    targetHeadroom: -85,
    fixed: [
      { merchant: "Rent · Immo Vandenberghe", category: "rent", amount: 850, offset: 2, channel: "transfer" },
      { merchant: "Basic-Fit", category: "subscriptions", amount: 29.99, recentAmount: 34.99, offset: 4, channel: "direct_debit" },
      { merchant: "Engie", category: "energy", amount: 98, recentAmount: 131, offset: 6, channel: "direct_debit" },
      { merchant: "Netflix", category: "subscriptions", amount: 13.99, offset: 14, channel: "card" },
      { merchant: "Spotify", category: "subscriptions", amount: 11.99, offset: 20, channel: "card" },
      { merchant: "Proximus", category: "telecom", amount: 45, offset: 22, channel: "direct_debit" },
    ],
    variable: [
      { category: "groceries", merchants: ["Colruyt", "Delhaize", "Aldi", "Albert Heijn"], perWeek: 2.2, min: 18, max: 64 },
      {
        category: "eating_out",
        merchants: ["Deliveroo", "Uber Eats", "Takeaway.com", "Balls & Glory", "Panos"],
        perWeek: 1.3,
        min: 9,
        max: 32,
        boost: { days: 26, perWeek: 3.4 },
      },
      { category: "transport", merchants: ["NMBS/SNCB", "De Lijn", "Blue-bike"], perWeek: 2, min: 2.5, max: 16 },
      { category: "shopping", merchants: ["Bol.com", "Zalando", "Action", "HEMA"], perWeek: 0.5, min: 12, max: 70 },
      { category: "leisure", merchants: ["Kinepolis Leuven", "Het Depot", "Café Commerce", "STUK"], perWeek: 0.8, min: 8, max: 38 },
      { category: "health", merchants: ["Apotheek Leuven"], perWeek: 0.15, min: 6, max: 24 },
    ],
    scheduled: (today) => [
      { date: addDays(today, 6), label: "Home insurance · annual", amount: 214, category: "insurance" },
    ],
  },
  {
    seed: 21,
    emoji: "🧑‍🎨",
    profile: {
      id: "bram",
      name: "Bram",
      age: 34,
      blurb: "Freelance UX designer (eenmanszaak) in Ghent",
      segment: "freelancer",
      incomeLabel: "Client payment",
      employer: "Studio Noord BV",
      bufferTarget: 1500,
    },
    daysUntilPayday: 16,
    income: 4200,
    savings: 6800,
    targetHeadroom: 1380,
    fixed: [
      { merchant: "Rent · Gent Wonen", category: "rent", amount: 1050, offset: 3, channel: "transfer" },
      { merchant: "Figma", category: "software", amount: 15, recentAmount: 18, offset: 5, channel: "card" },
      { merchant: "Luminus", category: "energy", amount: 112, offset: 7, channel: "direct_debit" },
      { merchant: "Adobe Creative Cloud", category: "software", amount: 66.99, recentAmount: 72.59, offset: 9, channel: "card" },
      { merchant: "Notion", category: "software", amount: 10, offset: 12, channel: "card" },
      { merchant: "Telenet", category: "telecom", amount: 58, offset: 14, channel: "direct_debit" },
      { merchant: "Boekhouder Claes", category: "other", amount: 95, offset: 18, channel: "transfer" },
    ],
    variable: [
      { category: "groceries", merchants: ["Delhaize", "Colruyt", "Lidl"], perWeek: 2, min: 20, max: 80 },
      { category: "eating_out", merchants: ["Lunchbar Mok", "Deliveroo", "Pakt Café"], perWeek: 1.6, min: 12, max: 42 },
      { category: "transport", merchants: ["Shell", "Q8", "NMBS/SNCB"], perWeek: 1.1, min: 15, max: 70 },
      { category: "shopping", merchants: ["Coolblue", "Bol.com", "IKEA"], perWeek: 0.6, min: 15, max: 120 },
      { category: "leisure", merchants: ["Vooruit", "Kinepolis Gent", "Handelsbeurs"], perWeek: 0.7, min: 10, max: 45 },
    ],
    scheduled: (today) => [
      { date: addDays(today, 9), label: "VAT Q3 · FOD Financiën", amount: 1840, category: "taxes" },
      { date: addDays(today, 13), label: "Social contributions · Xerius", amount: 870, category: "taxes" },
    ],
  },
  {
    seed: 99,
    emoji: "🎓",
    profile: {
      id: "noah",
      name: "Noah",
      age: 20,
      blurb: "Student at KU Leuven with a weekend job",
      segment: "student",
      incomeLabel: "Student job",
      employer: "Delhaize Leuven",
      bufferTarget: 150,
    },
    daysUntilPayday: 8,
    income: 610,
    savings: 900,
    targetHeadroom: 45,
    fixed: [
      { merchant: "Mobile Vikings", category: "telecom", amount: 15, offset: 3, channel: "direct_debit" },
      { merchant: "Basic-Fit", category: "subscriptions", amount: 24.99, offset: 5, channel: "direct_debit" },
      { merchant: "Disney+", category: "subscriptions", amount: 5.99, recentAmount: 9.99, offset: 11, channel: "card" },
      { merchant: "Spotify", category: "subscriptions", amount: 5.99, recentAmount: 6.99, offset: 24, channel: "card" },
    ],
    variable: [
      { category: "groceries", merchants: ["Aldi", "Colruyt", "Lidl"], perWeek: 1.7, min: 8, max: 32 },
      { category: "eating_out", merchants: ["Alma", "Frituur De Pelikaan", "Domino's"], perWeek: 2, min: 4, max: 16 },
      {
        category: "leisure",
        merchants: ["Café Belge", "Barvista", "Oude Markt · Café Den Boule", "STUK"],
        perWeek: 1,
        min: 6,
        max: 28,
        boost: { days: 20, perWeek: 3.6 },
      },
      { category: "transport", merchants: ["De Lijn", "NMBS/SNCB"], perWeek: 1, min: 2, max: 12 },
      { category: "shopping", merchants: ["Action", "Bol.com"], perWeek: 0.3, min: 8, max: 45 },
    ],
    scheduled: (today) => [
      { date: addDays(today, 3), label: "Course books · Acco", amount: 96, category: "shopping" },
    ],
  },
];

export const PERSONAS = SPECS.map((s) => ({ ...s.profile, emoji: s.emoji }));

function monthsBack(iso: string, n: number, day: number): string {
  const d = fromISO(iso);
  const target = new Date(d.getFullYear(), d.getMonth() - n, 1, 12);
  const len = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, len));
  return toISO(target);
}

export function buildPersona(id: string, today: string): FinState {
  const spec = SPECS.find((s) => s.profile.id === id) ?? SPECS[0];
  const rng = mulberry32(spec.seed);
  const nextPay = addDays(today, spec.daysUntilPayday);
  const paydayDay = Math.min(dayOfMonth(nextPay), 28);
  const profile: Profile = { ...spec.profile, paydayDay };

  const txs: Transaction[] = [];
  let n = 0;
  const add = (t: Omit<Transaction, "id">) => txs.push({ id: `t${++n}`, country: "BE", ...t });
  const HISTORY = 95;
  const inRange = (d: string) => {
    const age = diffDays(today, d);
    return age >= 0 && age <= HISTORY;
  };

  // paydays in the past (1..4 months back from next payday)
  for (let k = 1; k <= 4; k++) {
    const p = monthsBack(nextPay, k, paydayDay);
    if (inRange(p)) add({ date: p, time: "06:00", merchant: profile.employer, amount: spec.income, category: "income", channel: "transfer" });
    for (const f of spec.fixed) {
      const d = addDays(p, f.offset);
      if (!inRange(d)) continue;
      add({ date: d, time: "07:30", merchant: f.merchant, amount: -f.amount, category: f.category, channel: f.channel });
    }
  }
  // apply most-recent price changes
  for (const f of spec.fixed) {
    if (f.recentAmount === undefined) continue;
    const mine = txs.filter((t) => t.merchant === f.merchant).sort((a, b) => b.date.localeCompare(a.date));
    if (mine[0]) mine[0].amount = -f.recentAmount;
  }

  // everyday spending
  for (let age = HISTORY; age >= 0; age--) {
    const d = addDays(today, -age);
    for (const v of spec.variable) {
      const perWeek = v.boost && age < v.boost.days ? v.boost.perWeek : v.perWeek;
      const rate = perWeek / 7;
      let count = Math.floor(rate) + (rng() < rate % 1 ? 1 : 0);
      if (age === 0) count = Math.min(count, 1);
      for (let i = 0; i < count; i++) {
        const hour = 8 + Math.floor(rng() * 14);
        const min = Math.floor(rng() * 60);
        add({
          date: d,
          time: `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
          merchant: pick(rng, v.merchants),
          amount: -between(rng, v.min, v.max),
          category: v.category,
          channel: "card",
        });
      }
    }
  }

  txs.sort((a, b) => (b.date + (b.time ?? "")).localeCompare(a.date + (a.time ?? "")));

  const scheduled: ScheduledPayment[] = spec.scheduled(today).map((p, i) => ({
    ...p,
    id: `s${i + 1}`,
    source: "scheduled",
  }));

  const state: FinState = {
    today,
    profile,
    checking: 0,
    savings: spec.savings,
    transactions: txs,
    scheduled,
    budgets: [],
    goals: [],
    reminders: [],
    cardFrozen: false,
    reportedTx: [],
    confirmedTx: [],
    dismissed: [],
    activity: [],
  };

  // Calibrate the balance so the story lands exactly (projection is linear in the balance).
  const probe = analyze(state);
  state.checking = round2(profile.bufferTarget + spec.targetHeadroom - probe.lowest.balance + 0.37);
  return state;
}

// ---------------------------------------------------------------------------
// Demo scenarios: inject an event live on stage and watch Kate react.
// ---------------------------------------------------------------------------

export type ScenarioId = "suspicious" | "surprise_bill" | "delivery_binge" | "bonus";

export const SCENARIOS: { id: ScenarioId; emoji: string; label: string; hint: string }[] = [
  { id: "suspicious", emoji: "🚨", label: "Suspicious payment", hint: "€389 online, from Lithuania, 03:12" },
  { id: "surprise_bill", emoji: "🧾", label: "Surprise bill", hint: "A repair bill lands in 4 days" },
  { id: "delivery_binge", emoji: "🍕", label: "Delivery binge", hint: "3 food orders in 3 days" },
  { id: "bonus", emoji: "🎉", label: "Bonus lands", hint: "+€600 one-off" },
];

export function applyScenario(s: FinState, id: ScenarioId): FinState {
  const next: FinState = { ...s, transactions: [...s.transactions], scheduled: [...s.scheduled] };
  const newId = () => `x${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const addTx = (t: Omit<Transaction, "id">) => {
    const tx = { id: newId(), country: "BE", ...t };
    next.transactions.unshift(tx);
    next.checking = round2(next.checking + tx.amount);
    return tx;
  };
  switch (id) {
    case "suspicious":
      addTx({ date: s.today, time: "03:12", merchant: "SHOPMAX DIGITAL UAB", amount: -389, category: "shopping", country: "LT", channel: "online" });
      break;
    case "surprise_bill": {
      const student = s.profile.segment === "student";
      next.scheduled.push({
        id: newId(),
        date: addDays(s.today, 4),
        label: student ? "Laptop repair · iRepair Leuven" : "Car repair · Garage Peeters",
        amount: student ? 220 : 420,
        category: "other",
        source: "scheduled",
      });
      break;
    }
    case "delivery_binge":
      addTx({ date: addDays(s.today, -2), time: "21:14", merchant: "Deliveroo", amount: -24.5, category: "eating_out", channel: "card" });
      addTx({ date: addDays(s.today, -1), time: "20:47", merchant: "Uber Eats", amount: -31.2, category: "eating_out", channel: "card" });
      addTx({ date: s.today, time: "12:31", merchant: "Deliveroo", amount: -19.9, category: "eating_out", channel: "card" });
      next.transactions.sort((a, b) => (b.date + (b.time ?? "")).localeCompare(a.date + (a.time ?? "")));
      break;
    case "bonus":
      addTx({ date: s.today, time: "09:00", merchant: `${s.profile.employer} · bonus`, amount: 600, category: "transfer", channel: "transfer" });
      break;
  }
  return next;
}
