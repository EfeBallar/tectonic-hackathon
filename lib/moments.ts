// Moment detection. Every detector reads signals only (never the demo ground truth) and returns
// a confidence plus human-readable evidence, tagged with the signal group it came from.
// Code calculates, AI explains, the customer approves.

import type { Customer } from "./population";

export type Pillar = "protect" | "support" | "guide";
export type ProductLine = "banking" | "insurance" | "investment";
export type SignalGroup = "money" | "behavior" | "context" | "life";

export interface Evidence {
  group: SignalGroup;
  text: string;
  weight?: number;
}

export interface Detection {
  momentId: MomentId;
  confidence: number; // 0..1
  evidence: Evidence[];
}

export type MomentId =
  | "scam_in_progress"
  | "card_fraud"
  | "cash_crunch"
  | "duplicate_bill"
  | "bill_increase"
  | "first_job"
  | "salary_drop"
  | "subscription_creep"
  | "card_expiring"
  | "moving"
  | "new_dependent"
  | "salary_rise"
  | "idle_cash";

export interface MomentDef {
  id: MomentId;
  label: string;
  pillar: Pillar;
  productLine: ProductLine;
  commercial: boolean; // needs consent for personalized offers
  realtime: boolean; // live guard at payment time vs nightly batch
  bigMoment: boolean; // route to a human advisor when consented
  action: (c: Customer) => { title: string; message: string; cta: string };
  detect: (c: Customer) => Detection | null;
}

const eur = (n: number) => `€${Math.round(n).toLocaleString("nl-BE")}`;
const clamp = (n: number) => Math.max(0, Math.min(0.99, Math.round(n * 100) / 100));

// ---------------------------------------------------------------- live guard

export type GuardTier = "allow" | "check" | "pause" | "block";

export interface GuardResult {
  score: number;
  tier: GuardTier;
  factors: Evidence[];
}

/**
 * Scores a payment the customer is about to make against their baseline.
 * Runs at payment time, in microseconds: the baseline was precomputed by the nightly pass.
 */
export function assessPayment(c: Customer): GuardResult | null {
  const s = c.session;
  const a = s?.attempt;
  if (!s || !a) return null;
  const f: Evidence[] = [];
  const add = (group: SignalGroup, weight: number, text: string) => f.push({ group, weight, text });

  if (a.payee.flag === "blacklisted") add("money", 1, `Payee IBAN is on KBC's scam blacklist`);
  if (a.payee.flag === "suspect") add("money", 0.2, `Payee reported as suspicious by other customers`);
  if (a.payee.firstSeenDaysAgo === 0) add("money", 0.2, `First payment ever to "${a.payee.name}"`);
  if (!a.payee.iban.startsWith("BE")) add("money", 0.1, `Foreign account (${a.payee.iban.slice(0, 2)})`);
  if (a.amount > c.baseline.typicalMaxPayment * 1.5)
    add("money", 0.15, `${eur(a.amount)} is far above their usual max payment of ${eur(c.baseline.typicalMaxPayment)}`);
  if (a.amount > (c.checking + c.savingsBalance) * 0.5) add("money", 0.1, `Would move more than half of all their money`);
  if (a.currency !== c.baseline.usualCurrency) add("money", 0.1, `Unusual currency ${a.currency}`);
  if (s.activeCall) add("context", 0.25, `A phone call is active while paying`);
  if (s.remoteAccessApp) add("context", 0.25, `Remote-access app running: ${s.remoteAccessApp}`);
  if (s.device === "new") add("context", 0.1, `New device`);
  if (s.country !== c.baseline.usualCountry) add("context", 0.1, `Unusual location (${s.country})`);
  if (s.hour < c.baseline.usualHours[0] || s.hour >= c.baseline.usualHours[1] - 1)
    add("behavior", 0.05, `Late for them: ${s.hour}:00`);
  if (s.hesitationSec > 20) add("behavior", 0.1, `Hesitated ${s.hesitationSec}s on the confirm screen`);
  if (s.attempts >= 2) add("behavior", 0.1, `${s.attempts} attempts at the same payment`);

  const score = clamp(f.reduce((t, x) => t + (x.weight ?? 0), 0));
  const tier: GuardTier = score >= 0.99 && a.payee.flag === "blacklisted" ? "block" : score >= 0.7 ? "pause" : score >= 0.35 ? "check" : "allow";
  return { score, tier, factors: f };
}

// ---------------------------------------------------------------- detectors

export const MOMENTS: MomentDef[] = [
  {
    id: "scam_in_progress",
    label: "Scam in progress",
    pillar: "protect",
    productLine: "banking",
    commercial: false,
    realtime: true,
    bigMoment: false,
    action: (c) => ({
      title: "Stop. Is someone on the phone with you?",
      message: `KBC will never call you and ask you to move money or install an app. We paused this ${eur(c.session?.attempt?.amount ?? 0)} payment. Hang up and call us on a number you trust.`,
      cta: "Call the real KBC",
    }),
    detect: (c) => {
      const g = assessPayment(c);
      if (!g || g.tier === "allow") return null;
      return { momentId: "scam_in_progress", confidence: g.score, evidence: g.factors };
    },
  },
  {
    id: "card_fraud",
    label: "Suspicious card payment",
    pillar: "protect",
    productLine: "banking",
    commercial: false,
    realtime: true,
    bigMoment: false,
    action: () => ({ title: "Was this you?", message: "We spotted a card payment that doesn't look like you. One tap to freeze your card.", cta: "Freeze card" }),
    detect: (c) => {
      const t = c.recent.find((x) => x.tag === "card_foreign" && x.daysAgo <= 1);
      if (!t) return null;
      return {
        momentId: "card_fraud",
        confidence: 0.82,
        evidence: [
          { group: "money", text: `${t.label}: ${eur(-t.amount)}` },
          { group: "context", text: `Merchant abroad, customer usually pays in ${c.baseline.usualCountry}` },
        ],
      };
    },
  },
  {
    id: "cash_crunch",
    label: "Overdraft coming",
    pillar: "support",
    productLine: "banking",
    commercial: false,
    realtime: false,
    bigMoment: false,
    action: (c) => {
      const gap = projectedGap(c);
      const day = negativeInDays(c);
      return {
        title: `Heads up: you'll go negative ${day === null ? "before payday" : `on the ${ordinal(dateIn(day))}`}`,
        message: c.savingsBalance > gap
          ? `Your bills and usual spending add up to ${eur(gap)} more than your balance before your salary lands in ${c.daysToPayday} days. Move ${eur(gap)} from savings now and put it back on payday.`
          : `Your bills and usual spending add up to ${eur(gap)} more than your balance before payday. Let's see which payments can wait, no fees.`,
        cta: c.savingsBalance > gap ? `Move ${eur(gap)} from savings` : "Make a plan with Kate",
      };
    },
    detect: (c) => {
      const gap = projectedGap(c);
      if (gap <= 0) return null;
      const day = negativeInDays(c);
      return {
        momentId: "cash_crunch",
        confidence: clamp(0.65 + Math.min(0.3, gap / c.baseline.monthlyIncome)),
        evidence: [
          { group: "money", text: `Balance ${eur(c.checking)}; ${eur(c.upcomingOutflows)} in direct debits due in ${c.billsDueInDays} days` },
          { group: "money", text: `Usual spending ${eur(c.dailySpend)}/day (last months' trend), salary in ${c.daysToPayday} days` },
          ...(day !== null ? [{ group: "money" as const, text: `Forecast: balance goes below zero in ${day} days, ${eur(gap)} short at the lowest point` }] : []),
        ],
      };
    },
  },
  {
    id: "duplicate_bill",
    label: "Bill paid twice",
    pillar: "protect",
    productLine: "banking",
    commercial: false,
    realtime: false,
    bigMoment: false,
    action: (c) => {
      const d = findDuplicate(c)!;
      return { title: `${d.label} was paid twice`, message: `Two payments of ${eur(-d.amount)} to ${d.label} within a few days. Want us to ask for one back?`, cta: "Request a refund" };
    },
    detect: (c) => {
      const d = findDuplicate(c);
      return d ? { momentId: "duplicate_bill", confidence: 0.9, evidence: [{ group: "money", text: `2 × ${eur(-d.amount)} to ${d.label} within 3 days (same amount, same beneficiary)` }] } : null;
    },
  },
  {
    id: "bill_increase",
    label: "Bill higher than usual",
    pillar: "support",
    productLine: "banking",
    commercial: false,
    realtime: false,
    bigMoment: false,
    action: (c) => {
      const b = c.changedDomiciliations[0];
      return { title: `${b.label} went up to ${eur(b.now)}`, message: `Usually ${eur(b.usual)}. That's ${eur((b.now - b.usual) * 12)} more a year if it stays. Want to check the contract or compare?`, cta: "Look into it" };
    },
    detect: (c) => {
      const b = c.changedDomiciliations.find((x) => x.now > x.usual * 1.2);
      if (!b) return null;
      return {
        momentId: "bill_increase",
        confidence: clamp(0.6 + Math.min(0.3, (b.now / b.usual - 1) / 3)),
        evidence: [{ group: "money", text: `Direct debit ${b.label}: ${eur(b.now)}, usually ${eur(b.usual)} (+${Math.round((b.now / b.usual - 1) * 100)}%)` }],
      };
    },
  },
  {
    id: "first_job",
    label: "First job",
    pillar: "guide",
    productLine: "investment",
    commercial: false,
    realtime: false,
    bigMoment: false,
    action: (c) => ({
      title: "Your first salary. Congrats!",
      message: `Most people's spending jumps in the first months of a job. Decide now: keep ${eur(Math.round(c.salaryNow * 0.1 / 10) * 10)}/month for yourself, automatically, the day your salary lands.`,
      cta: "Set up my 10% plan",
    }),
    detect: (c) => {
      const t = c.recent.find((x) => x.tag === "first_salary");
      if (!t) return null;
      return {
        momentId: "first_job",
        confidence: 0.9,
        evidence: [
          { group: "life", text: `First salary received: ${t.label.replace("First salary · ", "")}, ${eur(t.amount)}` },
          { group: "money", text: `Income went from ${eur(c.salaryPrev)} to ${eur(c.salaryNow)}` },
        ],
      };
    },
  },
  {
    id: "salary_drop",
    label: "Income dropped",
    pillar: "support",
    productLine: "banking",
    commercial: false,
    realtime: false,
    bigMoment: false,
    action: (c) => ({
      title: "Your income changed this month",
      message: `This salary was ${eur(c.salaryNow)}, usually ${eur(c.salaryPrev)}. Want a quick look at what that means for your bills?`,
      cta: "Review my month",
    }),
    detect: (c) =>
      c.salaryNow < c.salaryPrev * 0.85
        ? {
            momentId: "salary_drop",
            confidence: 0.8,
            evidence: [{ group: "life", text: `Salary ${eur(c.salaryNow)}, usually ${eur(c.salaryPrev)} (${Math.round((1 - c.salaryNow / c.salaryPrev) * 100)}% less)` }],
          }
        : null,
  },
  {
    id: "subscription_creep",
    label: "Subscription creep",
    pillar: "support",
    productLine: "banking",
    commercial: false,
    realtime: false,
    bigMoment: false,
    action: (c) => {
      const t = c.newDomiciliations.filter((d) => d.amount < 40).reduce((s, d) => s + d.amount, 0);
      return { title: `${eur(t)}/month in new subscriptions`, message: "You added several subscriptions in the last month. Want a list so you can keep only the ones you use?", cta: "Show subscriptions" };
    },
    detect: (c) => {
      const subs = c.newDomiciliations.filter((d) => d.amount < 40 && d.daysAgo <= 30);
      if (subs.length < 3) return null;
      return {
        momentId: "subscription_creep",
        confidence: clamp(0.55 + subs.length * 0.05),
        evidence: [{ group: "money", text: `${subs.length} new direct debits in 30 days: ${subs.map((s) => s.label).join(", ")}` }],
      };
    },
  },
  {
    id: "card_expiring",
    label: "Card expiring",
    pillar: "support",
    productLine: "banking",
    commercial: false,
    realtime: false,
    bigMoment: false,
    action: (c) => ({ title: `Your card expires in ${c.cardExpiresInDays} days`, message: "Your new card is on its way. Here's which subscriptions still use the old one.", cta: "Check linked payments" }),
    detect: (c) =>
      c.cardExpiresInDays <= 30
        ? { momentId: "card_expiring", confidence: 0.95, evidence: [{ group: "context", text: `Card expires in ${c.cardExpiresInDays} days` }] }
        : null,
  },
  {
    id: "moving",
    label: "Moving house",
    pillar: "guide",
    productLine: "insurance",
    commercial: true,
    realtime: false,
    bigMoment: true,
    action: (c) => {
      const dep = c.recent.find((t) => t.tag === "deposit");
      return {
        title: "Moving? We'll handle the admin in one go",
        message: `${dep ? `Your ${eur(-dep.amount)} deposit is paid. ` : ""}Change your address once for all KBC products, get home insurance for the new place and a moving budget.`,
        cta: "Plan my move",
      };
    },
    detect: (c) => {
      const ev: Evidence[] = [];
      let conf = 0;
      const dep = c.recent.find((t) => t.tag === "deposit");
      if (dep) { conf += 0.45; ev.push({ group: "money", text: `Rent deposit paid: ${eur(-dep.amount)}` }); }
      const furn = c.recent.filter((t) => t.tag === "furniture");
      if (furn.length) { conf += 0.2; ev.push({ group: "money", text: `Furniture / DIY spend: ${furn.map((t) => t.label).join(", ")}` }); }
      const rent = c.newDomiciliations.find((d) => d.label.startsWith("Rent"));
      if (rent) { conf += 0.25; ev.push({ group: "money", text: `New standing order to a new landlord: ${eur(rent.amount)}/month` }); }
      if (c.life.addressChangedDaysAgo !== undefined) { conf += 0.2; ev.push({ group: "life", text: `Address changed ${c.life.addressChangedDaysAgo} days ago` }); }
      if (!conf) return null;
      if (!c.products.homeInsurance) ev.push({ group: "life", text: "No home insurance with KBC yet" });
      return { momentId: "moving", confidence: clamp(conf), evidence: ev };
    },
  },
  {
    id: "new_dependent",
    label: "New family member",
    pillar: "guide",
    productLine: "insurance",
    commercial: true,
    realtime: false,
    bigMoment: true,
    action: () => ({ title: "Congratulations on the new family member", message: "A few things change now: family insurance, a savings account for later, and your budget. Want an advisor to walk you through it?", cta: "Book a 15-min call" }),
    detect: (c) => {
      const cb = c.recent.find((t) => t.tag === "child_benefit");
      if (!cb || c.life.dependentAddedDaysAgo === undefined) return null;
      return {
        momentId: "new_dependent",
        confidence: 0.85,
        evidence: [
          { group: "life", text: `Dependent added to the family file ${c.life.dependentAddedDaysAgo} days ago` },
          { group: "money", text: `First child benefit received: ${eur(cb.amount)}` },
        ],
      };
    },
  },
  {
    id: "salary_rise",
    label: "Raise or new job",
    pillar: "guide",
    productLine: "investment",
    commercial: true,
    realtime: false,
    bigMoment: false,
    action: (c) => {
      const extra = Math.round((c.salaryNow - c.salaryPrev) * 0.3 / 10) * 10;
      return { title: "Nice raise. Want to keep a part of it?", message: `Put ${eur(extra)}/month aside automatically, the day your salary lands. You won't miss it.`, cta: `Start a ${eur(extra)}/month plan` };
    },
    detect: (c) =>
      c.salaryNow > c.salaryPrev * 1.1 && !c.recent.some((t) => t.tag === "first_salary")
        ? { momentId: "salary_rise", confidence: 0.75, evidence: [{ group: "life", text: `Salary ${eur(c.salaryNow)}, up from ${eur(c.salaryPrev)}` }] }
        : null,
  },
  {
    id: "idle_cash",
    label: "Idle savings",
    pillar: "guide",
    productLine: "investment",
    commercial: true,
    realtime: false,
    bigMoment: false,
    action: (c) => {
      const surplus = idleSurplus(c);
      return { title: `${eur(surplus)} is sitting still`, message: `You keep a safe buffer of 3 months of expenses, well done. The other ${eur(surplus)} hasn't moved in ${c.savingsIdleDays} days. Give it a goal and watch it fill up.`, cta: "Set a savings goal" };
    },
    detect: (c) => {
      if (c.products.investments || c.savingsIdleDays < 60) return null;
      const surplus = idleSurplus(c);
      if (surplus < 1000) return null;
      return {
        momentId: "idle_cash",
        confidence: clamp(0.6 + Math.min(0.25, surplus / (c.baseline.monthlyIncome * 20))),
        evidence: [
          { group: "money", text: `${eur(c.savingsBalance)} in savings, ${eur(surplus)} above 3 months of expenses (${eur(monthlyExpenses(c))}/month)` },
          { group: "behavior", text: `Savings balance unchanged for ${c.savingsIdleDays} days, no investments` },
        ],
      };
    },
  },
];

export const MOMENT_BY_ID = Object.fromEntries(MOMENTS.map((m) => [m.id, m])) as Record<MomentId, MomentDef>;

function findDuplicate(c: Customer) {
  const bills = c.recent.filter((t) => t.tag === "bill");
  for (let i = 0; i < bills.length; i++)
    for (let j = i + 1; j < bills.length; j++)
      if (bills[i].label === bills[j].label && bills[i].amount === bills[j].amount && Math.abs(bills[i].daysAgo - bills[j].daysAgo) <= 3) return bills[i];
  return null;
}

export function monthlyExpenses(c: Customer): number {
  return Math.round((c.dailySpend * 30 + c.upcomingOutflows) / 10) * 10;
}
export function idleSurplus(c: Customer): number {
  return Math.round((c.savingsBalance - 3 * monthlyExpenses(c)) / 10) * 10;
}
/** Day (from today) the balance first goes below zero before payday, or null. */
export function negativeInDays(c: Customer): number | null {
  for (let d = 0; d < c.daysToPayday; d++) {
    const bal = c.checking - c.dailySpend * (d + 1) - (d >= c.billsDueInDays ? c.upcomingOutflows : 0);
    if (bal < 0) return d + 1;
  }
  return null;
}
function dateIn(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.getDate();
}
function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}

export function projectedGap(c: Customer): number {
  const gap = c.upcomingOutflows + c.dailySpend * c.daysToPayday - c.checking;
  return gap > 0 ? Math.round(gap / 10) * 10 : 0;
}

export function detectAll(c: Customer): Detection[] {
  const out: Detection[] = [];
  for (const m of MOMENTS) {
    const d = m.detect(c);
    if (d) out.push(d);
  }
  return out;
}

/** Moments we could detect but deliberately don't. Shown in the UI. */
export const NOT_DETECTED: { label: string; why: string }[] = [
  { label: "Pregnancy or health", why: "from pharmacy, doctor or baby shop payments" },
  { label: "Religion or politics", why: "from donations or memberships" },
  { label: "Relationship breakups", why: "from split payments or a partner leaving a joint account" },
  { label: "Gambling-based targeting", why: "gambling signals may only trigger protective help, never offers" },
  { label: "Financial distress upsell", why: "a cash crunch never triggers a loan offer" },
];
