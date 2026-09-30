"use strict";

// scripts/experience-engine.ts
var import_node_fs = require("node:fs");

// lib/rng.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// lib/population.ts
var FIRST = [
  "Lotte",
  "Bram",
  "Noah",
  "Emma",
  "Lucas",
  "Marie",
  "Arthur",
  "Louise",
  "Jules",
  "Olivia",
  "Finn",
  "Elise",
  "Victor",
  "Nina",
  "Mathis",
  "Hanne",
  "Wout",
  "Fien",
  "Seppe",
  "Lien",
  "Ruben",
  "Jana",
  "Pieter",
  "Sofie",
  "Yasmina",
  "Mehdi",
  "Aylin",
  "Kobe",
  "Ines",
  "Thomas",
  "Anouk",
  "Milan",
  "Charlotte",
  "Lars",
  "Zo\xEB",
  "Rania"
];
var LAST = [
  "Peeters",
  "Janssens",
  "Maes",
  "Jacobs",
  "Mertens",
  "Willems",
  "Claes",
  "Goossens",
  "Wouters",
  "De Smet",
  "Dubois",
  "Lambert",
  "Vermeulen",
  "Hermans",
  "Aerts",
  "Bogaert",
  "El Amrani",
  "Yilmaz",
  "Van Damme",
  "Cools"
];
var CITIES = ["Leuven", "Gent", "Antwerpen", "Brussel", "Brugge", "Hasselt", "Mechelen", "Kortrijk", "Aalst"];
var SEGMENTS = [
  { seg: "student", w: 0.1, age: [18, 23], income: [300, 700] },
  { seg: "first_job", w: 0.1, age: [22, 26], income: [1900, 2500] },
  { seg: "young_pro", w: 0.22, age: [25, 35], income: [2400, 3600] },
  { seg: "family", w: 0.28, age: [32, 52], income: [3200, 5200] },
  { seg: "freelancer", w: 0.1, age: [27, 55], income: [2e3, 5500] },
  { seg: "retiree", w: 0.2, age: [65, 88], income: [1500, 2600] }
];
var SCAM_PAYEES = ["Safe Account KBC-Security", "Crypto Invest Pro", "Belastingdienst Terugbetaling", "Helpdesk Refund"];
function weighted(rng, arr) {
  let r = rng();
  for (const x of arr) if ((r -= x.w) < 0) return x;
  return arr[arr.length - 1];
}
var int = (rng, a, b) => Math.floor(a + rng() * (b - a + 1));
var r10 = (n) => Math.round(n / 10) * 10;
function iban(rng, country = "BE") {
  let d = "";
  for (let i = 0; i < 14; i++) d += int(rng, 0, 9);
  return `${country}${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6, 10)} ${d.slice(10, 14)}`;
}
var EVENT_RATES = {
  scamCall: 4e-3,
  // on a call + remote app + new payee + big amount
  benignNewPayee: 0.01,
  // large payment to a new payee, nothing else odd (ambiguous)
  blacklistedPayee: 1e-3,
  foreignCard: 4e-3,
  cashCrunch: 0.05,
  salaryDrop: 8e-3,
  salaryRise: 0.012,
  moving: 0.012,
  movingWeak: 0.01,
  // only a furniture spend, no deposit / address (ambiguous)
  newDependent: 5e-3,
  subscriptionCreep: 0.03,
  billIncrease: 0.03,
  // a domiciliation amount jumped (energy, telecom, insurance)
  duplicateBill: 6e-3,
  // same amount, same beneficiary, twice within days
  firstJob: 0.01
};
function generateCustomer(id) {
  const rng = mulberry32((id + 1) * 2654435761);
  const s = weighted(rng, SEGMENTS);
  const age = int(rng, s.age[0], s.age[1]);
  const income = r10(s.income[0] + rng() * (s.income[1] - s.income[0]));
  const name = `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
  const isYoung = s.seg === "student" || s.seg === "first_job";
  const truth = [];
  const c = {
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
      usualCurrency: "EUR"
    },
    products: {
      savings: rng() < (isYoung ? 0.5 : 0.85),
      investments: rng() < (s.seg === "retiree" ? 0.35 : isYoung ? 0.05 : 0.25),
      homeInsurance: rng() < (s.seg === "family" || s.seg === "retiree" ? 0.8 : 0.35),
      carInsurance: rng() < (s.seg === "student" ? 0.05 : 0.55),
      travelInsurance: rng() < 0.2,
      mortgage: rng() < (s.seg === "family" ? 0.6 : s.seg === "young_pro" ? 0.2 : 0.05)
    },
    consent: { personalizedOffers: rng() < 0.68, push: rng() < 0.75, advisor: rng() < 0.55 },
    preferredChannel: s.seg === "retiree" ? pick(rng, ["advisor", "email", "app"]) : pick(rng, ["app", "app", "push", "kate"]),
    interruptionsThisWeek: weighted(rng, [{ n: 0, w: 0.45 }, { n: 1, w: 0.25 }, { n: 2, w: 0.15 }, { n: 3, w: 0.1 }, { n: 4, w: 0.05 }]).n,
    relevance: {},
    checking: 0,
    savingsBalance: 0,
    daysToPayday: int(rng, 1, 30),
    upcomingOutflows: r10(income * (0.2 + rng() * 0.3)),
    billsDueInDays: 0,
    savingsIdleDays: int(rng, 0, 400),
    dailySpend: Math.round(income / 30 * (0.3 + rng() * 0.3)),
    salaryPrev: income,
    salaryNow: income,
    appSessionsLast7: 0,
    cardExpiresInDays: int(rng, 1, 1100),
    recent: [],
    newDomiciliations: [],
    changedDomiciliations: [],
    life: {},
    truth
  };
  if (rng() < 0.3) c.relevance[pick(rng, ["idle_cash", "salary_rise", "first_job"])] = 0.35 + rng() * 0.3;
  if (rng() < 0.15) c.relevance[pick(rng, ["subscription_creep", "bill_increase", "card_expiring"])] = 0.4 + rng() * 0.3;
  c.appSessionsLast7 = Math.max(0, c.baseline.appSessionsPerWeek + int(rng, -2, 2));
  c.savingsBalance = c.products.savings ? r10(income * (0.5 + rng() * rng() * 12)) : 0;
  c.billsDueInDays = int(rng, 0, Math.max(0, c.daysToPayday - 1));
  const need = c.upcomingOutflows + c.dailySpend * c.daysToPayday;
  c.checking = r10(need + income * (0.15 + rng() * 0.8));
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
    const [label, usual] = pick(rng, [["Engie energy", 110], ["Proximus", 65], ["Luminus", 95], ["Telenet", 70]]);
    c.changedDomiciliations.push({ label, usual, now: r10(usual * (1.3 + rng() * 0.9)), daysAgo: int(rng, 0, 6) });
    truth.push("bill_increase");
  }
  if (rng() < R.duplicateBill) {
    const [label, amt] = pick(rng, [["Fluvius", 84], ["Stad Leuven, belasting", 145], ["DKV Verzekering", 62]]);
    const d = int(rng, 0, 4);
    c.recent.push({ daysAgo: d, label, amount: -amt, tag: "bill" });
    c.recent.push({ daysAgo: d + int(rng, 0, 3), label, amount: -amt, tag: "bill" });
    truth.push("duplicate_bill");
  }
  if (s.seg === "first_job" || s.seg === "student" && rng() < R.firstJob * 10) {
    if (rng() < R.firstJob * 8) {
      c.salaryPrev = s.seg === "student" ? income : r10(income * 0.2);
      c.salaryNow = r10(1900 + rng() * 600);
      c.recent.push({ daysAgo: int(rng, 1, 6), label: `First salary \xB7 ${pick(rng, ["Colruyt Group", "Barco NV", "UZ Leuven", "Proximus"])}`, amount: c.salaryNow, tag: "first_salary" });
      c.dailySpend = Math.round(c.dailySpend * 1.6);
      truth.push("first_job");
    }
  }
  const hour = int(rng, c.baseline.usualHours[0], c.baseline.usualHours[1] - 1);
  c.session = { device: "known", activeCall: false, hour, country: "BE", hesitationSec: int(rng, 1, 6), attempts: 1 };
  if (rng() < R.scamCall) {
    const amount = r10(Math.max(c.checking + c.savingsBalance * 0.5, 1500) * (0.6 + rng() * 0.35));
    c.session = {
      device: rng() < 0.3 ? "new" : "known",
      activeCall: true,
      remoteAccessApp: rng() < 0.7 ? pick(rng, ["AnyDesk", "TeamViewer", "QuickSupport"]) : void 0,
      hour: rng() < 0.5 ? int(rng, 21, 23) : hour,
      country: "BE",
      hesitationSec: int(rng, 25, 140),
      attempts: int(rng, 1, 4),
      attempt: {
        payee: { name: pick(rng, SCAM_PAYEES), iban: iban(rng, pick(rng, ["BE", "LT", "NL"])), firstSeenDaysAgo: 0, flag: rng() < 0.4 ? "suspect" : void 0 },
        amount,
        currency: "EUR",
        note: pick(rng, ["veiligheid", "security transfer", "terugbetaling", "urgent"])
      }
    };
    truth.push("scam_call");
  } else if (rng() < R.blacklistedPayee) {
    c.session.attempt = {
      payee: { name: "Parcel Fee Delivery", iban: iban(rng, "LT"), firstSeenDaysAgo: 0, flag: "blacklisted" },
      amount: int(rng, 2, 4),
      currency: "EUR",
      note: "customs fee"
    };
    truth.push("blacklisted_payee");
  } else if (rng() < R.benignNewPayee) {
    c.session.attempt = {
      payee: { name: pick(rng, ["Garage Van Hool", "Notaris Claeys", "Aannemer De Vos", "Keukens Dewaele"]), iban: iban(rng), firstSeenDaysAgo: 0 },
      amount: r10(c.baseline.typicalMaxPayment * (1.5 + rng() * 2)),
      currency: "EUR",
      note: "factuur"
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

// lib/heroes.ts
function base(over) {
  const b = generateCustomer(7);
  return {
    ...b,
    city: "Leuven",
    consent: { personalizedOffers: true, push: true, advisor: true },
    preferredChannel: "app",
    interruptionsThisWeek: 0,
    relevance: {},
    appSessionsLast7: 6,
    cardExpiresInDays: 400,
    recent: [],
    newDomiciliations: [],
    changedDomiciliations: [],
    life: {},
    session: { device: "known", activeCall: false, hour: 18, country: "BE", hesitationSec: 3, attempts: 1 },
    truth: ["hero"],
    ...over
  };
}
var HEROES = [
  {
    id: -1,
    emoji: "\u{1F393}",
    label: "Student \xB7 scam call",
    story: "A fake \u201CKBC advisor\u201D is on the phone, AnyDesk is open, she's about to send her savings to a \u201Csafe account\u201D.",
    customer: base({
      id: -1,
      name: "Noor Aerts",
      age: 20,
      segment: "student",
      cardExpiresInDays: 19,
      baseline: { monthlyIncome: 650, typicalMaxPayment: 180, usualCountry: "BE", usualHours: [8, 24], appSessionsPerWeek: 12, knownPayees: 9, usualCurrency: "EUR" },
      products: { savings: true, investments: false, homeInsurance: false, carInsurance: false, travelInsurance: false, mortgage: false },
      checking: 640,
      savingsBalance: 1900,
      daysToPayday: 9,
      billsDueInDays: 3,
      upcomingOutflows: 120,
      dailySpend: 14,
      salaryPrev: 650,
      salaryNow: 650,
      savingsIdleDays: 20,
      recent: [{ daysAgo: 1, label: "Delhaize Leuven", amount: -23.4 }, { daysAgo: 2, label: "Student job \xB7 Colruyt", amount: 318 }],
      session: {
        device: "known",
        activeCall: true,
        remoteAccessApp: "AnyDesk",
        hour: 22,
        country: "BE",
        hesitationSec: 48,
        attempts: 2,
        attempt: { payee: { name: "KBC Veiligheidsrekening", iban: "LT21 3250 0412 7788 1203", firstSeenDaysAgo: 0, flag: "suspect" }, amount: 1850, currency: "EUR", note: "beveiliging account" }
      }
    })
  },
  {
    id: -2,
    emoji: "\u{1F3E0}",
    label: "Young renter \xB7 overdraft coming",
    story: "Rent and energy go out next week, salary lands later. The engine sees the dip before it happens.",
    customer: base({
      id: -2,
      name: "Lotte Peeters",
      age: 27,
      segment: "young_pro",
      baseline: { monthlyIncome: 2650, typicalMaxPayment: 900, usualCountry: "BE", usualHours: [7, 23], appSessionsPerWeek: 9, knownPayees: 22, usualCurrency: "EUR" },
      products: { savings: true, investments: false, homeInsurance: false, carInsurance: false, travelInsurance: false, mortgage: false },
      checking: 1180,
      savingsBalance: 2400,
      daysToPayday: 14,
      billsDueInDays: 5,
      upcomingOutflows: 1030,
      dailySpend: 38,
      salaryPrev: 2650,
      salaryNow: 2650,
      savingsIdleDays: 25,
      recent: [
        { daysAgo: 1, label: "Deliveroo", amount: -31.5 },
        { daysAgo: 2, label: "Colruyt Heverlee", amount: -64.2 },
        { daysAgo: 3, label: "NMBS", amount: -18 }
      ],
      changedDomiciliations: [{ label: "Engie energy", usual: 105, now: 118, daysAgo: 2 }],
      newDomiciliations: [{ label: "Disney+", amount: 11, daysAgo: 4 }, { label: "Basic-Fit", amount: 29, daysAgo: 12 }, { label: "Audible", amount: 10, daysAgo: 20 }]
    })
  },
  {
    id: -3,
    emoji: "\u{1F4BC}",
    label: "Mid-career \xB7 money sitting idle",
    story: "A solid buffer, plus money that hasn't moved in months. A goal that fills up, not a sales pitch.",
    customer: base({
      id: -3,
      name: "Pieter Janssens",
      age: 44,
      segment: "family",
      baseline: { monthlyIncome: 4200, typicalMaxPayment: 1400, usualCountry: "BE", usualHours: [7, 23], appSessionsPerWeek: 5, knownPayees: 31, usualCurrency: "EUR" },
      products: { savings: true, investments: false, homeInsurance: true, carInsurance: true, travelInsurance: false, mortgage: true },
      checking: 3100,
      savingsBalance: 12800,
      daysToPayday: 11,
      billsDueInDays: 4,
      upcomingOutflows: 1100,
      dailySpend: 60,
      salaryPrev: 4200,
      salaryNow: 4200,
      savingsIdleDays: 142,
      recent: [{ daysAgo: 2, label: "Aldi Kessel-Lo", amount: -88.1 }, { daysAgo: 4, label: "Total fuel", amount: -71 }],
      newDomiciliations: [{ label: "Disney+", amount: 11, daysAgo: 4 }, { label: "Basic-Fit", amount: 29, daysAgo: 12 }, { label: "Audible", amount: 10, daysAgo: 20 }],
      relevance: { subscription_creep: 0.4 }
    })
  },
  {
    id: -4,
    emoji: "\u{1F475}",
    label: "Retiree \xB7 bill paid twice",
    story: "The water bill went out twice this week. She's also paying a new payee, small and ordinary, so KBC doesn't cry wolf.",
    customer: base({
      id: -4,
      name: "Maria Claes",
      age: 78,
      segment: "retiree",
      baseline: { monthlyIncome: 1900, typicalMaxPayment: 450, usualCountry: "BE", usualHours: [8, 20], appSessionsPerWeek: 2, knownPayees: 11, usualCurrency: "EUR" },
      products: { savings: true, investments: true, homeInsurance: true, carInsurance: false, travelInsurance: false, mortgage: false },
      preferredChannel: "advisor",
      checking: 2300,
      savingsBalance: 21e3,
      daysToPayday: 12,
      billsDueInDays: 6,
      upcomingOutflows: 420,
      dailySpend: 35,
      salaryPrev: 1900,
      salaryNow: 1900,
      savingsIdleDays: 30,
      recent: [
        { daysAgo: 1, label: "De Watergroep", amount: -86, tag: "bill" },
        { daysAgo: 3, label: "De Watergroep", amount: -86, tag: "bill" },
        { daysAgo: 4, label: "Apotheek Claes", amount: -12.6 }
      ],
      session: {
        device: "known",
        activeCall: false,
        hour: 11,
        country: "BE",
        hesitationSec: 9,
        attempts: 1,
        attempt: { payee: { name: "Kapsalon Mieke", iban: "BE68 5390 0754 7034", firstSeenDaysAgo: 0 }, amount: 45, currency: "EUR", note: "knippen" }
      }
    })
  },
  {
    id: -5,
    emoji: "\u{1F476}",
    label: "New parent \xB7 all good",
    story: "Finances fine, and KBC already spoke to her 3 times this week. The subscription tip waits. The baby shop payment is ignored on purpose.",
    customer: base({
      id: -5,
      name: "Sofie Maes",
      age: 33,
      segment: "family",
      baseline: { monthlyIncome: 3600, typicalMaxPayment: 1100, usualCountry: "BE", usualHours: [6, 24], appSessionsPerWeek: 7, knownPayees: 27, usualCurrency: "EUR" },
      products: { savings: true, investments: true, homeInsurance: true, carInsurance: true, travelInsurance: true, mortgage: true },
      checking: 2900,
      savingsBalance: 6200,
      daysToPayday: 8,
      billsDueInDays: 3,
      upcomingOutflows: 1350,
      dailySpend: 55,
      salaryPrev: 3600,
      salaryNow: 3600,
      savingsIdleDays: 12,
      interruptionsThisWeek: 3,
      newDomiciliations: [{ label: "Disney+", amount: 11, daysAgo: 4 }, { label: "Basic-Fit", amount: 29, daysAgo: 12 }, { label: "Audible", amount: 10, daysAgo: 20 }],
      recent: [
        { daysAgo: 1, label: "Dreambaby Leuven", amount: -142 },
        { daysAgo: 2, label: "IKEA Zaventem", amount: -89, tag: "furniture" },
        { daysAgo: 3, label: "Delhaize", amount: -76.3 }
      ]
    })
  }
];

// lib/sensitive.ts
var SENSITIVE_RULES = [
  { category: "health", label: "Health", match: /apothe|pharma|ziekenhuis|hospital|huisarts|dokter|tandarts|kinesist|psycholo|mutualiteit|ziekenfonds|cm |helan|solidaris|labo/i },
  { category: "pregnancy_baby", label: "Pregnancy or baby", match: /dreambaby|baby|prenata|kraam|zwanger|maternity|pampers/i },
  { category: "religion", label: "Religion", match: /kerk|church|moskee|mosque|synago|parochie|diocese|zakat/i },
  { category: "politics", label: "Politics", match: /n-va|vooruit|groen|open vld|cd&v|vlaams belang|pvda|partij|party donation/i },
  { category: "union", label: "Union membership", match: /acv|abvv|aclvb|vakbond|union dues/i },
  { category: "sexual_orientation", label: "Sexual orientation", match: /pride|lgbt|çavaria|cavaria|grindr/i },
  { category: "gambling", label: "Gambling (protective help only)", match: /betnow|napoleon|ladbrokes|unibet|bwin|casino|betfirst/i }
];
function sensitiveCategory(t) {
  for (const r of SENSITIVE_RULES) if (r.match.test(t.label)) return r.category;
  return null;
}
function masked(c) {
  const hidden = [];
  const recent = c.recent.filter((t) => {
    const cat = sensitiveCategory(t);
    if (cat) hidden.push({ tx: t, category: cat });
    return !cat;
  });
  return { view: hidden.length ? { ...c, recent } : c, hidden };
}

// lib/moments.ts
var eur = (n) => `\u20AC${Math.round(n).toLocaleString("nl-BE")}`;
var clamp = (n) => Math.max(0, Math.min(0.99, Math.round(n * 100) / 100));
function assessPayment(c) {
  const s = c.session;
  const a = s?.attempt;
  if (!s || !a) return null;
  const f = [];
  const add = (group, weight, text) => f.push({ group, weight, text });
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
  const score2 = clamp(f.reduce((t, x) => t + (x.weight ?? 0), 0));
  const tier = score2 >= 0.99 && a.payee.flag === "blacklisted" ? "block" : score2 >= 0.7 ? "pause" : score2 >= 0.35 ? "check" : "allow";
  return { score: score2, tier, factors: f };
}
var MOMENTS = [
  {
    id: "scam_in_progress",
    label: "Scam in progress",
    pillar: "protect",
    productLine: "banking",
    commercial: false,
    realtime: true,
    bigMoment: false,
    action: (c) => {
      const g = assessPayment(c);
      const amt = eur(c.session?.attempt?.amount ?? 0);
      return g && g.tier === "check" ? { title: "First payment to this account", message: `Before the ${amt} leaves, check that the name matches who you mean to pay. Nothing unusual otherwise.`, cta: "Name matches, continue" } : { title: "Stop. Is someone on the phone with you?", message: `KBC will never call you and ask you to move money or install an app. We paused this ${amt} payment. Hang up and call us on a number you trust.`, cta: "Call the real KBC" };
    },
    detect: (c) => {
      const g = assessPayment(c);
      if (!g || g.tier === "allow") return null;
      return { momentId: "scam_in_progress", confidence: g.score, evidence: g.factors };
    }
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
          { group: "context", text: `Merchant abroad, customer usually pays in ${c.baseline.usualCountry}` }
        ]
      };
    }
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
        message: c.savingsBalance > gap ? `Your bills and usual spending add up to ${eur(gap)} more than your balance before your salary lands in ${c.daysToPayday} days. Move ${eur(gap)} from savings now and put it back on payday.` : `Your bills and usual spending add up to ${eur(gap)} more than your balance before payday. Let's see which payments can wait, no fees.`,
        cta: c.savingsBalance > gap ? `Move ${eur(gap)} from savings` : "Make a plan with Kate"
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
          ...day !== null ? [{ group: "money", text: `30-day forecast: below zero in ${day} days, ${eur(gap)} short at the lowest point` }] : []
        ]
      };
    }
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
      const d = findDuplicate(c);
      return { title: `${d.label} was paid twice`, message: `Two payments of ${eur(-d.amount)} to ${d.label} within a few days. Want us to ask for one back?`, cta: "Request a refund" };
    },
    detect: (c) => {
      const d = findDuplicate(c);
      return d ? { momentId: "duplicate_bill", confidence: 0.9, evidence: [{ group: "money", text: `2 \xD7 ${eur(-d.amount)} to ${d.label} within 3 days (same amount, same beneficiary)` }] } : null;
    }
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
      const b = increasedBill(c);
      return { title: `${b.label} went up to ${eur(b.now)}`, message: `Usually ${eur(b.usual)}. That's ${eur((b.now - b.usual) * 12)} more a year if it stays. Want to check the contract or compare?`, cta: "Look into it" };
    },
    detect: (c) => {
      const b = increasedBill(c);
      if (!b) return null;
      return {
        momentId: "bill_increase",
        confidence: clamp(0.6 + Math.min(0.3, (b.now / b.usual - 1) / 3)),
        evidence: [{ group: "money", text: `Direct debit ${b.label}: ${eur(b.now)}, usually ${eur(b.usual)} (+${Math.round((b.now / b.usual - 1) * 100)}%)` }]
      };
    }
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
      cta: "Set up my 10% plan"
      // SavingsGoal uses the same 10% default
    }),
    detect: (c) => {
      const t = c.recent.find((x) => x.tag === "first_salary");
      if (!t) return null;
      return {
        momentId: "first_job",
        confidence: 0.9,
        evidence: [
          { group: "life", text: `First salary received: ${t.label.replace("First salary \xB7 ", "")}, ${eur(t.amount)}` },
          { group: "money", text: `Income went from ${eur(c.salaryPrev)} to ${eur(c.salaryNow)}` }
        ]
      };
    }
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
      cta: "Review my month"
    }),
    detect: (c) => c.salaryNow < c.salaryPrev * 0.85 ? {
      momentId: "salary_drop",
      confidence: 0.8,
      evidence: [{ group: "life", text: `Salary ${eur(c.salaryNow)}, usually ${eur(c.salaryPrev)} (${Math.round((1 - c.salaryNow / c.salaryPrev) * 100)}% less)` }]
    } : null
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
        evidence: [{ group: "money", text: `${subs.length} new direct debits in 30 days: ${subs.map((s) => s.label).join(", ")}` }]
      };
    }
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
    detect: (c) => c.cardExpiresInDays <= 30 ? { momentId: "card_expiring", confidence: 0.95, evidence: [{ group: "context", text: `Card expires in ${c.cardExpiresInDays} days` }] } : null
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
        cta: "Plan my move"
      };
    },
    detect: (c) => {
      const ev = [];
      let conf = 0;
      const dep = c.recent.find((t) => t.tag === "deposit");
      if (dep) {
        conf += 0.45;
        ev.push({ group: "money", text: `Rent deposit paid: ${eur(-dep.amount)}` });
      }
      const furn = c.recent.filter((t) => t.tag === "furniture");
      if (furn.length) {
        conf += 0.2;
        ev.push({ group: "money", text: `Furniture / DIY spend: ${furn.map((t) => t.label).join(", ")}` });
      }
      const rent = c.newDomiciliations.find((d) => d.label.startsWith("Rent"));
      if (rent) {
        conf += 0.25;
        ev.push({ group: "money", text: `New standing order to a new landlord: ${eur(rent.amount)}/month` });
      }
      if (c.life.addressChangedDaysAgo !== void 0) {
        conf += 0.2;
        ev.push({ group: "life", text: `Address changed ${c.life.addressChangedDaysAgo} days ago` });
      }
      if (!conf) return null;
      if (!c.products.homeInsurance) ev.push({ group: "life", text: "No home insurance with KBC yet" });
      return { momentId: "moving", confidence: clamp(conf), evidence: ev };
    }
  },
  {
    // Only from declared/administrative data (family file, child benefit), never inferred from spending.
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
      if (!cb || c.life.dependentAddedDaysAgo === void 0) return null;
      return {
        momentId: "new_dependent",
        confidence: 0.85,
        evidence: [
          { group: "life", text: `Dependent added to the family file ${c.life.dependentAddedDaysAgo} days ago` },
          { group: "money", text: `First child benefit received: ${eur(cb.amount)}` }
        ]
      };
    }
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
    detect: (c) => c.salaryNow > c.salaryPrev * 1.1 && !c.recent.some((t) => t.tag === "first_salary") ? { momentId: "salary_rise", confidence: 0.75, evidence: [{ group: "life", text: `Salary ${eur(c.salaryNow)}, up from ${eur(c.salaryPrev)}` }] } : null
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
      if (surplus < 1e3) return null;
      return {
        momentId: "idle_cash",
        confidence: clamp(0.6 + Math.min(0.25, surplus / (c.baseline.monthlyIncome * 20))),
        evidence: [
          { group: "money", text: `${eur(c.savingsBalance)} in savings, ${eur(surplus)} above 3 months of expenses (${eur(monthlyExpenses(c))}/month)` },
          { group: "behavior", text: `Savings balance unchanged for ${c.savingsIdleDays} days, no investments` }
        ]
      };
    }
  }
];
MOMENTS.push(
  {
    id: "first_debit",
    label: "A new recurring payment",
    pillar: "support",
    productLine: "banking",
    commercial: false,
    realtime: false,
    bigMoment: false,
    detect: (c) => {
      const p = c.scheduledPayments?.find((x) => x.first && !x.cancelled && x.dueInDays <= 7);
      return p ? { momentId: "first_debit", confidence: 0.95, evidence: [{ group: "money", text: `${p.label}: first ${eur(p.amount)} payment due in ${p.dueInDays} days` }] } : null;
    },
    action: (c) => {
      const p = c.scheduledPayments?.find((x) => x.first && !x.cancelled && x.dueInDays <= 7);
      return { title: `${p?.label ?? "A new payment"} starts soon`, message: `The first ${eur(p?.amount ?? 0)} payment is scheduled in ${p?.dueInDays ?? 0} days. Check it now, while there is time to cancel.`, cta: "Cancel this payment" };
    }
  },
  {
    id: "recent_incident",
    label: "Follow up on your request",
    pillar: "support",
    productLine: "banking",
    commercial: false,
    realtime: false,
    bigMoment: true,
    detect: (c) => c.openIncidents?.length ? { momentId: "recent_incident", confidence: 0.95, evidence: [{ group: "context", text: `You opened: ${c.openIncidents[0].label}` }] } : null,
    action: (c) => ({ title: "You shouldn't have to explain twice", message: `Your advisor can see your request about ${c.openIncidents?.[0]?.label ?? "your account"} and the relevant account context.`, cta: "Request an advisor" })
  },
  {
    id: "life_transition",
    label: "Plan your next chapter",
    pillar: "guide",
    productLine: "banking",
    commercial: false,
    realtime: false,
    bigMoment: true,
    detect: (c) => c.transition ? { momentId: "life_transition", confidence: 0.95, evidence: [{ group: "life", text: `You told us: ${c.transition.label}` }, { group: "money", text: `${eur(c.transition.upfront)} upfront and ${eur(c.transition.monthly)} per month` }] } : null,
    action: (c) => {
      const t = c.transition;
      const income = t.incomeAfter ?? c.salaryNow;
      const left = income - monthlyExpenses(c) - t.monthly;
      return { title: `Make room for ${t.label}`, message: `${eur(t.upfront)} upfront, then ${eur(t.monthly)} a month. With income of ${eur(income)}, your projected monthly remainder is ${eur(left)}. We can build a plan around that.`, cta: "Make a savings plan" };
    }
  },
  ...[["travel", "A trip abroad"], ["vehicle_purchase", "Your next car"]].map(([id, label]) => ({
    id,
    label,
    pillar: "guide",
    productLine: "insurance",
    commercial: false,
    realtime: false,
    bigMoment: false,
    detect: () => null,
    action: (c) => {
      const n = c.importedMoments?.find((x) => x.momentId === id);
      return { title: n?.title ?? label, message: n?.message ?? "Review what this means for your plans.", cta: "Review with Kate" };
    }
  }))
);
var MOMENT_BY_ID = Object.fromEntries(MOMENTS.map((m) => [m.id, m]));
function findDuplicate(c) {
  const bills = c.recent.filter((t) => t.tag === "bill");
  for (let i = 0; i < bills.length; i++)
    for (let j = i + 1; j < bills.length; j++)
      if (bills[i].label === bills[j].label && bills[i].amount === bills[j].amount && Math.abs(bills[i].daysAgo - bills[j].daysAgo) <= 3) return bills[i];
  return null;
}
function increasedBill(c) {
  return c.changedDomiciliations.find((x) => x.now > x.usual * 1.2) ?? null;
}
function monthlyExpenses(c) {
  return Math.round((c.dailySpend * 30 + c.upcomingOutflows) / 10) * 10;
}
function idleSurplus(c) {
  return Math.round((c.savingsBalance - 3 * monthlyExpenses(c)) / 10) * 10;
}
var FORECAST_DAYS = 30;
function forecast(c) {
  const out = [c.checking];
  let bal = c.checking;
  const billDay = Math.max(1, c.billsDueInDays);
  for (let d = 1; d <= FORECAST_DAYS; d++) {
    bal -= c.dailySpend;
    if (d === billDay || d === billDay + 30) bal -= c.upcomingOutflows;
    if (d === c.daysToPayday || d === c.daysToPayday + 30) bal += c.salaryNow;
    for (const p of c.scheduledPayments ?? []) if (!p.cancelled && d === p.dueInDays) bal -= p.amount;
    out.push(bal);
  }
  return out;
}
function negativeInDays(c) {
  const f = forecast(c);
  const d = f.findIndex((b) => b < 0);
  return d > 0 ? d : null;
}
function dateIn(days) {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() + days);
  return d.getDate();
}
function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${s}`;
}
function projectedGap(c) {
  const low = Math.min(...forecast(c));
  return low < 0 ? Math.ceil(-low / 10) * 10 : 0;
}
function detectAll(c) {
  const out = [];
  const { view } = masked(c);
  for (const m of MOMENTS) {
    const d = m.detect(m.pillar === "protect" ? c : view);
    if (d) out.push(d);
  }
  for (const n of c.importedMoments ?? []) {
    if (MOMENT_BY_ID[n.momentId] && !out.some((x) => x.momentId === n.momentId))
      out.push({ momentId: n.momentId, confidence: n.confidence, evidence: [{ group: "money", text: n.evidence }] });
  }
  return out;
}

// lib/orchestrator.ts
var POLICY = {
  minConfidence: 0.6,
  // below this we don't act (ambiguous signals stay silent)
  weeklyBudget: 3,
  // proactive interruptions per customer per week (PM: "for example 3")
  minPriority: 0.08
  // not worth an interruption below this
};
var SCORING = {
  scam_in_progress: { urgency: 1, cost: 0 },
  card_fraud: { urgency: 0.95, cost: 0 },
  duplicate_bill: { urgency: 0.7, cost: 0.05 },
  cash_crunch: { urgency: 0.8, cost: 0.05 },
  bill_increase: { urgency: 0.45, cost: 0.08 },
  salary_drop: { urgency: 0.55, cost: 0.08 },
  subscription_creep: { urgency: 0.3, cost: 0.1 },
  card_expiring: { urgency: 0.35, cost: 0.08 },
  first_job: { urgency: 0.5, cost: 0.1 },
  moving: { urgency: 0.55, cost: 0.1 },
  new_dependent: { urgency: 0.45, cost: 0.12 },
  salary_rise: { urgency: 0.35, cost: 0.08 },
  idle_cash: { urgency: 0.3, cost: 0.08 },
  first_debit: { urgency: 0.65, cost: 0.05 },
  recent_incident: { urgency: 0.75, cost: 0.03 },
  life_transition: { urgency: 0.55, cost: 0.08 },
  travel: { urgency: 0.45, cost: 0.08 },
  vehicle_purchase: { urgency: 0.5, cost: 0.08 }
};
function pickChannel(c, momentId) {
  const m = MOMENT_BY_ID[momentId];
  if (m.pillar === "protect") return m.realtime && c.session?.attempt ? "app" : c.consent.push ? "push" : "app";
  if (m.bigMoment && c.consent.advisor) return "advisor";
  const appActive = c.appSessionsLast7 >= 1;
  if (c.preferredChannel === "push" && !c.consent.push) return appActive ? "app" : "email";
  if (c.preferredChannel === "advisor" && !c.consent.advisor) return appActive ? "app" : "email";
  if ((c.preferredChannel === "app" || c.preferredChannel === "kate") && !appActive) return "email";
  return c.preferredChannel;
}
function score(c, d) {
  const m = MOMENT_BY_ID[d.momentId];
  const { urgency, cost } = SCORING[d.momentId];
  const relevance = c.relevance[d.momentId] ?? 1;
  const priority = Math.round((urgency * d.confidence * relevance - cost) * 1e3) / 1e3;
  return { momentId: d.momentId, confidence: d.confidence, urgency, relevance, cost, priority, bypass: m.pillar === "protect" };
}
function decide(c, opts = {}, all = detectAll(c)) {
  const detections = c.resolved?.length ? all.filter((d) => !c.resolved.includes(d.momentId)) : all;
  const size = opts.budget ?? POLICY.weeklyBudget;
  const used = c.interruptionsThisWeek;
  const held = [];
  const ranked = detections.map((d) => score(c, d)).sort((a, b) => Number(b.bypass) - Number(a.bypass) || b.priority - a.priority);
  const eligible = [];
  for (const s of ranked) {
    const m2 = MOMENT_BY_ID[s.momentId];
    const p = s.priority;
    if (s.confidence < (m2.realtime && s.bypass ? 0.35 : POLICY.minConfidence)) {
      held.push({ momentId: s.momentId, reason: "low_confidence", priority: p, text: `Confidence ${pct(s.confidence)} is below ${pct(POLICY.minConfidence)}: not sure enough, so we stay quiet` });
    } else if (!s.bypass && c.consent.muted?.includes(s.momentId)) {
      held.push({ momentId: s.momentId, reason: "muted", priority: p, text: "You turned this kind of message off" });
    } else if (m2.commercial && !c.consent.personalizedOffers) {
      held.push({ momentId: s.momentId, reason: "no_consent", priority: p, text: "You switched off personalized offers" });
    } else if (!s.bypass && used >= size && !c.presented?.includes(s.momentId)) {
      held.push({ momentId: s.momentId, reason: "budget_full", priority: p, text: `Attention budget used: ${used} of ${size} interruptions this week. It waits.` });
    } else if (!s.bypass && p < POLICY.minPriority) {
      held.push({ momentId: s.momentId, reason: "not_worth_it", priority: p, text: `Priority ${p.toFixed(2)} is too low to be worth interrupting you` });
    } else eligible.push(s);
  }
  const [top, ...rest] = eligible;
  for (const s of rest)
    held.push({ momentId: s.momentId, reason: "lower_priority", priority: s.priority, text: `Lost the slot to "${MOMENT_BY_ID[top.momentId].label}" (${s.priority.toFixed(2)} vs ${top.priority.toFixed(2)})` });
  const budget = { used, size };
  if (!top) return { customerId: c.id, detections, ranked, chosen: null, held, checks: [], budget };
  const m = MOMENT_BY_ID[top.momentId];
  const channel = pickChannel(c, top.momentId);
  const checks = [
    `Confidence ${pct(top.confidence)} \u2265 ${pct(POLICY.minConfidence)}`,
    `Priority ${top.priority.toFixed(2)} = urgency ${top.urgency} \xD7 confidence ${top.confidence} \xD7 relevance ${top.relevance.toFixed(2)} \u2212 cost ${top.cost}`,
    m.commercial ? "You consented to personalized offers" : "Not commercial: no offer consent needed",
    top.bypass ? "Protection: bypasses the attention budget" : `Attention budget: ${used} of ${size} used this week`
  ];
  const reason = channel === "advisor" ? "Big life moment: a human advisor, with an AI-prepared brief" : m.realtime ? "Live: shown inside the payment flow, before money leaves" : `Fits their behavior (${c.appSessionsLast7} app sessions this week, prefers ${c.preferredChannel})`;
  return { customerId: c.id, detections, ranked, chosen: { momentId: top.momentId, channel, confidence: top.confidence, priority: top.priority, reason }, held, checks, budget };
}
var pct = (n) => `${Math.round(n * 100)}%`;

// lib/demoActions.ts
var eur2 = (n) => `\u20AC${Math.round(n).toLocaleString("nl-BE")}`;
var money = (n) => typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0;
function reduce(c, prev, a) {
  const p = { ...prev };
  const resolve = (id) => {
    p.resolved = [...p.resolved ?? [], id];
  };
  const log = (t) => {
    p.log = [t, ...p.log ?? []].slice(0, 20);
  };
  const spendSlot = (id) => {
    const shown = p.presented ?? c.presented ?? [];
    if (shown.includes(id)) return;
    p.presented = [...shown, id];
    if (MOMENT_BY_ID[id]?.pillar !== "protect") p.used = (p.used ?? 0) + 1;
  };
  const learn = (id, acted) => {
    const cur = c.relevance[id] ?? 1;
    p.relevance = { ...p.relevance, [id]: Math.max(0.1, Math.min(1.5, cur * (acted ? 1.15 : 0.5))) };
  };
  if ("momentId" in a && a.kind !== "present") learn(a.momentId, a.kind !== "dismiss");
  switch (a.kind) {
    case "present":
      spendSlot(a.momentId);
      return p;
    case "cancel_payment": {
      const due = c.scheduledPayments?.find((x) => x.id === a.paymentId && !x.cancelled);
      if (!due) return p;
      p.scheduledPayments = c.scheduledPayments.map((x) => x.id === a.paymentId ? { ...x, cancelled: true } : x);
      resolve(a.momentId);
      spendSlot(a.momentId);
      log(`Cancelled the scheduled ${eur2(due.amount)} payment to ${due.label} in this synthetic account.`);
      return p;
    }
    case "transfer_from_savings": {
      const amt = Math.min(money(a.amount), c.savingsBalance);
      if (amt <= 0) return p;
      p.balances = { checking: c.checking + amt, savings: c.savingsBalance - amt };
      resolve(a.momentId);
      spendSlot(a.momentId);
      log(`Moved ${eur2(amt)} from savings to your current account. Reminder set to move it back on payday.`);
      return p;
    }
    case "refund":
      resolve(a.momentId);
      spendSlot(a.momentId);
      log(`Refund requested: ${eur2(money(a.amount))} from ${a.payee}. Usually back within 5 working days.`);
      return p;
    case "scam": {
      const at = c.session?.attempt;
      resolve("scam_in_progress");
      if (!at) return p;
      if (a.outcome === "cancelled") log(`Payment of ${eur2(at.amount)} to \u201C${at.payee.name}\u201D cancelled. The money never left.`);
      if (a.outcome === "delayed") log(`Payment of ${eur2(at.amount)} held for 24 hours. You can still cancel it until then.`);
      if (a.outcome === "handoff") log(`Payment of ${eur2(at.amount)} held while you talked to the KBC fraud team (simulated in this demo).`);
      return p;
    }
    case "goal": {
      const target = Math.max(1, money(a.target));
      const available = c.savingsBalance + (c.goal?.saved ?? 0);
      const fromIdle = Math.min(money(a.fromIdle), available, target);
      p.goal = { label: a.label, target, monthly: money(a.monthly), saved: fromIdle, shape: a.shape };
      p.balances = { checking: c.checking, savings: available - fromIdle };
      resolve(a.momentId);
      spendSlot(a.momentId);
      log(`Goal \u201C${a.label}\u201D started with ${eur2(fromIdle)}. ${eur2(a.monthly)} goes in every payday.`);
      return p;
    }
    case "ack":
      resolve(a.momentId);
      spendSlot(a.momentId);
      log(a.text);
      return p;
    case "dismiss":
      resolve(a.momentId);
      spendSlot(a.momentId);
      log(`Hid \u201C${MOMENT_BY_ID[a.momentId]?.label}\u201D. You'll see this kind of message less often.`);
      return p;
    default:
      return p;
  }
}

// lib/pass.ts
function applyPatch(c, p) {
  if (!p) return c;
  return {
    ...c,
    consent: p.consent ?? c.consent,
    relevance: { ...c.relevance, ...p.relevance },
    checking: p.balances?.checking ?? c.checking,
    savingsBalance: p.balances?.savings ?? c.savingsBalance,
    interruptionsThisWeek: c.interruptionsThisWeek + (p.used ?? 0),
    resolved: p.resolved ?? c.resolved,
    goal: p.goal ?? c.goal,
    log: p.log ?? c.log,
    presented: p.presented ?? c.presented,
    scheduledPayments: p.scheduledPayments ?? c.scheduledPayments,
    trustedContact: p.trustedContact ?? c.trustedContact
  };
}

// scripts/experience-engine.ts
var input = JSON.parse((0, import_node_fs.readFileSync)(0, "utf8"));
if (input.op === "heroes") {
  process.stdout.write(JSON.stringify(HEROES.map((h) => ({ ...h, customer_id: `H00${-h.id}` }))));
} else {
  let c = input.customer;
  if (!c || !Number.isFinite(c.checking)) throw new Error("Invalid customer snapshot");
  if (input.action) {
    const a = input.action;
    const selected2 = decide(c, { budget: input.budget ?? 3 }).chosen?.momentId;
    const id = a.kind === "scam" ? "scam_in_progress" : a.momentId;
    if (id !== selected2) throw new Error("This moment is no longer selected. Refresh before acting.");
    const allowed = a.kind === "present" || a.kind === "dismiss" && id !== "scam_in_progress" || a.kind === "scam" && id === "scam_in_progress" || a.kind === "transfer_from_savings" && id === "cash_crunch" || a.kind === "refund" && id === "duplicate_bill" || a.kind === "goal" && ["idle_cash", "first_job", "salary_rise", "life_transition"].includes(id ?? "") || a.kind === "cancel_payment" && id === "first_debit" || a.kind === "ack" && id !== "scam_in_progress";
    if (!allowed) throw new Error("Action is not available for this moment");
    if (a.kind === "refund") {
      const bill = c.recent.find((t) => t.tag === "bill");
      if (!bill || Math.abs(bill.amount) !== a.amount || bill.label !== a.payee) throw new Error("Invalid refund request");
    }
    c = applyPatch(c, reduce(c, void 0, a));
  }
  const decision = decide(c, { budget: input.budget ?? 3 });
  const selected = decision.chosen?.momentId;
  const action = selected ? MOMENT_BY_ID[selected].action(c) : null;
  process.stdout.write(JSON.stringify({ customer: c, decision, action, forecast: forecast(c) }));
}
