// Synthetic customer population. Deterministic: the same id always gives the same customer.
// Each customer carries the signals the PM listed (money, behavior, context, life), split into
// a slow "static persona" (baseline, refreshed nightly) and a fast "live state" (right now).
// No real data: names, IBANs and merchants are invented.

import { mulberry32, pick, type Rng } from "./rng";

export type Segment = "student" | "first_job" | "young_pro" | "family" | "freelancer" | "retiree";
export type Channel = "app" | "push" | "kate" | "email" | "advisor";

export interface Payee {
  name: string;
  iban: string;
  firstSeenDaysAgo: number; // 0 = added in this session
  flag?: "blacklisted" | "suspect"; // shared bank-wide scam intelligence
}

export interface SignalTx {
  daysAgo: number;
  label: string;
  amount: number; // negative = out
  tag?: string; // machine tag the detectors read, e.g. "deposit", "furniture", "salary"
}

/** A payment the customer is trying to make right now (live guard input). */
export interface PaymentAttempt {
  payee: Payee;
  amount: number;
  currency: string;
  note: string;
}

export interface Session {
  device: "known" | "new";
  activeCall: boolean; // phone call in progress while banking
  remoteAccessApp?: string; // AnyDesk, TeamViewer... detected running
  hour: number; // local hour
  country: string;
  hesitationSec: number; // time spent on the confirm screen
  attempts: number; // repeated tries of the same payment
  attempt?: PaymentAttempt;
}

export interface Customer {
  id: number;
  name: string;
  age: number;
  segment: Segment;
  city: string;

  // --- static persona (baseline, computed nightly from history) ---
  baseline: {
    monthlyIncome: number;
    typicalMaxPayment: number; // 95th percentile outgoing payment
    usualCountry: string;
    usualHours: [number, number];
    appSessionsPerWeek: number;
    knownPayees: number;
    usualCurrency: string;
  };
  products: {
    savings: boolean;
    investments: boolean;
    homeInsurance: boolean;
    carInsurance: boolean;
    travelInsurance: boolean;
    mortgage: boolean;
  };
  consent: { personalizedOffers: boolean; push: boolean; advisor: boolean; muted?: string[] };
  preferredChannel: Channel;
  /** Attention budget: proactive interruptions already used this week. */
  interruptionsThisWeek: number;
  /** Learned per customer from past reactions: <1 = they tend to ignore this kind of moment. */
  relevance: Record<string, number>;

  // --- live state (money / behavior / context / life) ---
  checking: number;
  savingsBalance: number;
  daysToPayday: number;
  upcomingOutflows: number; // known bills (domiciliations) before payday
  billsDueInDays: number; // when those bills hit
  savingsIdleDays: number; // days since the savings balance last moved
  dailySpend: number;
  salaryPrev: number;
  salaryNow: number;
  appSessionsLast7: number;
  cardExpiresInDays: number;
  recent: SignalTx[]; // notable recent transactions (the evidence trail)
  newDomiciliations: { label: string; amount: number; daysAgo: number }[];
  /** Direct debits whose amount changed vs their usual amount. */
  changedDomiciliations: { label: string; usual: number; now: number; daysAgo: number }[];
  life: { addressChangedDaysAgo?: number; dependentAddedDaysAgo?: number; newLoanDaysAgo?: number };
  session?: Session;
  /** Ground truth for the demo only (what we injected). Detectors never read this. */
  truth: string[];
}

const FIRST = [
  "Lotte", "Bram", "Noah", "Emma", "Lucas", "Marie", "Arthur", "Louise", "Jules", "Olivia", "Finn", "Elise",
  "Victor", "Nina", "Mathis", "Hanne", "Wout", "Fien", "Seppe", "Lien", "Ruben", "Jana", "Pieter", "Sofie",
  "Yasmina", "Mehdi", "Aylin", "Kobe", "Ines", "Thomas", "Anouk", "Milan", "Charlotte", "Lars", "Zoë", "Rania",
];
const LAST = [
  "Peeters", "Janssens", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens", "Wouters", "De Smet",
  "Dubois", "Lambert", "Vermeulen", "Hermans", "Aerts", "Bogaert", "El Amrani", "Yilmaz", "Van Damme", "Cools",
];
const CITIES = ["Leuven", "Gent", "Antwerpen", "Brussel", "Brugge", "Hasselt", "Mechelen", "Kortrijk", "Aalst"];

const SEGMENTS: { seg: Segment; w: number; age: [number, number]; income: [number, number] }[] = [
  { seg: "student", w: 0.1, age: [18, 23], income: [300, 700] },
  { seg: "first_job", w: 0.1, age: [22, 26], income: [1900, 2500] },
  { seg: "young_pro", w: 0.22, age: [25, 35], income: [2400, 3600] },
  { seg: "family", w: 0.28, age: [32, 52], income: [3200, 5200] },
  { seg: "freelancer", w: 0.1, age: [27, 55], income: [2000, 5500] },
  { seg: "retiree", w: 0.2, age: [65, 88], income: [1500, 2600] },
];

const SCAM_PAYEES = ["Safe Account KBC-Security", "Crypto Invest Pro", "Belastingdienst Terugbetaling", "Helpdesk Refund"];

function weighted<T extends { w: number }>(rng: Rng, arr: T[]): T {
  let r = rng();
  for (const x of arr) if ((r -= x.w) < 0) return x;
  return arr[arr.length - 1];
}
const int = (rng: Rng, a: number, b: number) => Math.floor(a + rng() * (b - a + 1));
const r10 = (n: number) => Math.round(n / 10) * 10;

function iban(rng: Rng, country = "BE"): string {
  let d = "";
  for (let i = 0; i < 14; i++) d += int(rng, 0, 9);
  return `${country}${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6, 10)} ${d.slice(10, 14)}`;
}

/** Rates per nightly pass. Tuned so the control room shows a realistic long tail. */
export const EVENT_RATES = {
  scamCall: 0.004, // on a call + remote app + new payee + big amount
  benignNewPayee: 0.01, // large payment to a new payee, nothing else odd (ambiguous)
  blacklistedPayee: 0.001,
  foreignCard: 0.004,
  cashCrunch: 0.05,
  salaryDrop: 0.008,
  salaryRise: 0.012,
  moving: 0.012,
  movingWeak: 0.01, // only a furniture spend, no deposit / address (ambiguous)
  newDependent: 0.005,
  subscriptionCreep: 0.03,
  billIncrease: 0.03, // a domiciliation amount jumped (energy, telecom, insurance)
  duplicateBill: 0.006, // same amount, same beneficiary, twice within days
  firstJob: 0.01,
};

export function generateCustomer(id: number): Customer {
  const rng = mulberry32((id + 1) * 2654435761);
  const s = weighted(rng, SEGMENTS);
  const age = int(rng, s.age[0], s.age[1]);
  const income = r10(s.income[0] + rng() * (s.income[1] - s.income[0]));
  const name = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
  const isYoung = s.seg === "student" || s.seg === "first_job";
  const truth: string[] = [];

  const c: Customer = {
    id,
    name,
    age,
    segment: s.seg,
    city: pick(rng, CITIES),
    baseline: {
      monthlyIncome: income,
      typicalMaxPayment: r10(income * (0.25 + rng() * 0.35)),
      usualCountry: "BE",
      usualHours: s.seg === "retiree" ? [8, 20] : [7, 23],
      appSessionsPerWeek: s.seg === "retiree" ? int(rng, 0, 4) : int(rng, 3, 20),
      knownPayees: int(rng, 6, 40),
      usualCurrency: "EUR",
    },
    products: {
      savings: rng() < (isYoung ? 0.5 : 0.85),
      investments: rng() < (s.seg === "retiree" ? 0.35 : isYoung ? 0.05 : 0.25),
      homeInsurance: rng() < (s.seg === "family" || s.seg === "retiree" ? 0.8 : 0.35),
      carInsurance: rng() < (s.seg === "student" ? 0.05 : 0.55),
      travelInsurance: rng() < 0.2,
      mortgage: rng() < (s.seg === "family" ? 0.6 : s.seg === "young_pro" ? 0.2 : 0.05),
    },
    consent: { personalizedOffers: rng() < 0.68, push: rng() < 0.75, advisor: rng() < 0.55 },
    preferredChannel: s.seg === "retiree" ? pick(rng, ["advisor", "email", "app"] as Channel[]) : pick(rng, ["app", "app", "push", "kate"] as Channel[]),
    interruptionsThisWeek: weighted(rng, [{ n: 0, w: 0.45 }, { n: 1, w: 0.25 }, { n: 2, w: 0.15 }, { n: 3, w: 0.1 }, { n: 4, w: 0.05 }]).n,
    relevance: {},
    checking: 0,
    savingsBalance: 0,
    daysToPayday: int(rng, 1, 30),
    upcomingOutflows: r10(income * (0.2 + rng() * 0.3)),
    billsDueInDays: 0,
    savingsIdleDays: int(rng, 0, 400),
    dailySpend: Math.round((income / 30) * (0.3 + rng() * 0.3)),
    salaryPrev: income,
    salaryNow: income,
    appSessionsLast7: 0,
    cardExpiresInDays: int(rng, 1, 1100),
    recent: [],
    newDomiciliations: [],
    changedDomiciliations: [],
    life: {},
    truth,
  };
  // past reactions: some customers keep ignoring growth nudges, some ignore bill tips
  if (rng() < 0.3) c.relevance[pick(rng, ["idle_cash", "salary_rise", "first_job"])] = 0.35 + rng() * 0.3;
  if (rng() < 0.15) c.relevance[pick(rng, ["subscription_creep", "bill_increase", "card_expiring"])] = 0.4 + rng() * 0.3;
  c.appSessionsLast7 = Math.max(0, c.baseline.appSessionsPerWeek + int(rng, -2, 2));
  c.savingsBalance = c.products.savings ? r10(income * (0.5 + rng() * rng() * 12)) : 0;

  c.billsDueInDays = int(rng, 0, Math.max(0, c.daysToPayday - 1));
  // healthy default: checking covers the bills until payday with some margin
  const need = c.upcomingOutflows + c.dailySpend * c.daysToPayday;
  c.checking = r10(need + income * (0.15 + rng() * 0.8));

  // --- inject life / money events ---
  const R = EVENT_RATES;

  if (rng() < R.cashCrunch) {
    c.checking = r10(need * (0.45 + rng() * 0.4));
    truth.push("cash_crunch");
  }
  if (rng() < R.salaryDrop && s.seg !== "retiree") {
    c.salaryNow = r10(income * (0.55 + rng() * 0.25));
    c.recent.push({ daysAgo: int(rng, 1, 6), label: "Salary", amount: c.salaryNow, tag: "salary" });
    truth.push("salary_drop");
  } else if (rng() < R.salaryRise && s.seg !== "retiree") {
    c.salaryNow = r10(income * (1.15 + rng() * 0.4));
    c.recent.push({ daysAgo: int(rng, 1, 6), label: "Salary", amount: c.salaryNow, tag: "salary" });
    truth.push("salary_rise");
  }
  if (rng() < R.moving && s.seg !== "retiree") {
    const rent = r10(700 + rng() * 700);
    c.recent.push({ daysAgo: int(rng, 2, 10), label: "Huurwaarborg (rent deposit)", amount: -rent * 2, tag: "deposit" });
    c.recent.push({ daysAgo: int(rng, 1, 8), label: "IKEA Zaventem", amount: -r10(250 + rng() * 900), tag: "furniture" });
    if (rng() < 0.7) c.recent.push({ daysAgo: int(rng, 1, 5), label: "Brico Plan-it", amount: -r10(60 + rng() * 300), tag: "furniture" });
    c.newDomiciliations.push({ label: "Rent to new landlord", amount: rent, daysAgo: int(rng, 1, 12) });
    if (rng() < 0.6) c.life.addressChangedDaysAgo = int(rng, 0, 7);
    truth.push("moving");
  } else if (rng() < R.movingWeak) {
    c.recent.push({ daysAgo: int(rng, 1, 10), label: "IKEA Gent", amount: -r10(80 + rng() * 300), tag: "furniture" });
    truth.push("moving_weak");
  }
  if (rng() < R.newDependent && (s.seg === "family" || s.seg === "young_pro")) {
    c.life.dependentAddedDaysAgo = int(rng, 3, 40);
    c.recent.push({ daysAgo: int(rng, 1, 20), label: "Groeipakket (child benefit)", amount: r10(170 + rng() * 60), tag: "child_benefit" });
    truth.push("new_dependent");
  }
  if (rng() < R.subscriptionCreep) {
    const subs = ["Netflix", "Disney+", "Spotify", "Streamz", "Basic-Fit", "Audible", "Xbox Game Pass"];
    const n = int(rng, 3, 4);
    for (let i = 0; i < n; i++)
      c.newDomiciliations.push({ label: subs[(id + i) % subs.length], amount: int(rng, 8, 30), daysAgo: int(rng, 1, 30) });
    truth.push("subscription_creep");
  }

  if (rng() < R.billIncrease) {
    const [label, usual] = pick(rng, [["Engie energy", 110], ["Proximus", 65], ["Luminus", 95], ["Telenet", 70]] as [string, number][]);
    c.changedDomiciliations.push({ label, usual, now: r10(usual * (1.3 + rng() * 0.9)), daysAgo: int(rng, 0, 6) });
    truth.push("bill_increase");
  }
  if (rng() < R.duplicateBill) {
    const [label, amt] = pick(rng, [["Fluvius", 84], ["Stad Leuven, belasting", 145], ["DKV Verzekering", 62]] as [string, number][]);
    const d = int(rng, 0, 4);
    c.recent.push({ daysAgo: d, label, amount: -amt, tag: "bill" });
    c.recent.push({ daysAgo: d + int(rng, 0, 3), label, amount: -amt, tag: "bill" });
    truth.push("duplicate_bill");
  }
  if (s.seg === "first_job" || (s.seg === "student" && rng() < R.firstJob * 10)) {
    if (rng() < R.firstJob * 8) {
      c.salaryPrev = s.seg === "student" ? income : r10(income * 0.2);
      c.salaryNow = r10(1900 + rng() * 600);
      c.recent.push({ daysAgo: int(rng, 1, 6), label: `First salary · ${pick(rng, ["Colruyt Group", "Barco NV", "UZ Leuven", "Proximus"])}`, amount: c.salaryNow, tag: "first_salary" });
      c.dailySpend = Math.round(c.dailySpend * 1.6);
      truth.push("first_job");
    }
  }

  // --- live session (context signals) ---
  const hour = int(rng, c.baseline.usualHours[0], c.baseline.usualHours[1] - 1);
  c.session = { device: "known", activeCall: false, hour, country: "BE", hesitationSec: int(rng, 1, 6), attempts: 1 };

  if (rng() < R.scamCall) {
    // classic "bank helpdesk" scam: caller talks the customer through a transfer
    const amount = r10(Math.max(c.checking + c.savingsBalance * 0.5, 1500) * (0.6 + rng() * 0.35));
    c.session = {
      device: rng() < 0.3 ? "new" : "known",
      activeCall: true,
      remoteAccessApp: rng() < 0.7 ? pick(rng, ["AnyDesk", "TeamViewer", "QuickSupport"]) : undefined,
      hour: rng() < 0.5 ? int(rng, 21, 23) : hour,
      country: "BE",
      hesitationSec: int(rng, 25, 140),
      attempts: int(rng, 1, 4),
      attempt: {
        payee: { name: pick(rng, SCAM_PAYEES), iban: iban(rng, pick(rng, ["BE", "LT", "NL"])), firstSeenDaysAgo: 0, flag: rng() < 0.4 ? "suspect" : undefined },
        amount,
        currency: "EUR",
        note: pick(rng, ["veiligheid", "security transfer", "terugbetaling", "urgent"]),
      },
    };
    truth.push("scam_call");
  } else if (rng() < R.blacklistedPayee) {
    c.session.attempt = {
      payee: { name: "Parcel Fee Delivery", iban: iban(rng, "LT"), firstSeenDaysAgo: 0, flag: "blacklisted" },
      amount: int(rng, 2, 4),
      currency: "EUR",
      note: "customs fee",
    };
    truth.push("blacklisted_payee");
  } else if (rng() < R.benignNewPayee) {
    // big payment to someone new, but nothing else odd: a car dealer, a contractor, a notary
    c.session.attempt = {
      payee: { name: pick(rng, ["Garage Van Hool", "Notaris Claeys", "Aannemer De Vos", "Keukens Dewaele"]), iban: iban(rng), firstSeenDaysAgo: 0 },
      amount: r10(c.baseline.typicalMaxPayment * (1.5 + rng() * 2)),
      currency: "EUR",
      note: "factuur",
    };
    c.session.hesitationSec = int(rng, 3, 12);
    truth.push("benign_new_payee");
  }
  if (rng() < R.foreignCard) {
    c.recent.push({ daysAgo: 0, label: pick(rng, ["SHOPX*ELECTRO HK", "PAY*GIFTCARDS RO", "BETNOW MT"]), amount: -r10(90 + rng() * 600), tag: "card_foreign" });
    truth.push("foreign_card");
  }

  c.recent.sort((a, b) => a.daysAgo - b.daysAgo);
  return c;
}

/** Hand-picked demo customers, found by scanning ids, so the pitch always has the same heroes. */
export function findExample(tag: string, from = 0, limit = 50000): Customer | null {
  for (let i = from; i < from + limit; i++) {
    const c = generateCustomer(i);
    if (c.truth.includes(tag)) return c;
  }
  return null;
}
