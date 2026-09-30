// Five hand-written demo customers (PM action plan, phase 1). Negative ids so they never
// collide with the generated population. The engine treats them exactly like everyone else.

import { generateCustomer, type Customer } from "./population";

function base(over: Partial<Customer> & Pick<Customer, "id" | "name" | "age" | "segment">): Customer {
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
    ...over,
  };
}

export const HEROES: { id: number; emoji: string; label: string; story: string; customer: Customer }[] = [
  {
    id: -1,
    emoji: "🎓",
    label: "Student · scam call",
    story: "A fake “KBC advisor” is on the phone, AnyDesk is open, she's about to send her savings to a “safe account”.",
    customer: base({
      id: -1, name: "Noor Aerts", age: 20, segment: "student",
      baseline: { monthlyIncome: 650, typicalMaxPayment: 180, usualCountry: "BE", usualHours: [8, 24], appSessionsPerWeek: 12, knownPayees: 9, usualCurrency: "EUR" },
      products: { savings: true, investments: false, homeInsurance: false, carInsurance: false, travelInsurance: false, mortgage: false },
      checking: 640, savingsBalance: 1900, daysToPayday: 9, billsDueInDays: 3, upcomingOutflows: 120, dailySpend: 14, salaryPrev: 650, salaryNow: 650, savingsIdleDays: 20,
      recent: [{ daysAgo: 1, label: "Delhaize Leuven", amount: -23.4 }, { daysAgo: 2, label: "Student job · Colruyt", amount: 318 }],
      session: {
        device: "known", activeCall: true, remoteAccessApp: "AnyDesk", hour: 22, country: "BE", hesitationSec: 48, attempts: 2,
        attempt: { payee: { name: "KBC Veiligheidsrekening", iban: "LT21 3250 0412 7788 1203", firstSeenDaysAgo: 0, flag: "suspect" }, amount: 1850, currency: "EUR", note: "beveiliging account" },
      },
    }),
  },
  {
    id: -2,
    emoji: "🏠",
    label: "Young renter · overdraft coming",
    story: "Rent and energy go out next week, salary lands later. The engine sees the dip before it happens.",
    customer: base({
      id: -2, name: "Lotte Peeters", age: 27, segment: "young_pro",
      baseline: { monthlyIncome: 2650, typicalMaxPayment: 900, usualCountry: "BE", usualHours: [7, 23], appSessionsPerWeek: 9, knownPayees: 22, usualCurrency: "EUR" },
      products: { savings: true, investments: false, homeInsurance: false, carInsurance: false, travelInsurance: false, mortgage: false },
      checking: 1180, savingsBalance: 2400, daysToPayday: 14, billsDueInDays: 5, upcomingOutflows: 1030, dailySpend: 38, salaryPrev: 2650, salaryNow: 2650, savingsIdleDays: 25,
      recent: [
        { daysAgo: 1, label: "Deliveroo", amount: -31.5 },
        { daysAgo: 2, label: "Colruyt Heverlee", amount: -64.2 },
        { daysAgo: 3, label: "NMBS", amount: -18 },
      ],
      changedDomiciliations: [{ label: "Engie energy", usual: 105, now: 118, daysAgo: 2 }],
    }),
  },
  {
    id: -3,
    emoji: "💼",
    label: "Mid-career · money sitting idle",
    story: "A solid buffer, plus money that hasn't moved in months. A goal that fills up, not a sales pitch.",
    customer: base({
      id: -3, name: "Pieter Janssens", age: 44, segment: "family",
      baseline: { monthlyIncome: 4200, typicalMaxPayment: 1400, usualCountry: "BE", usualHours: [7, 23], appSessionsPerWeek: 5, knownPayees: 31, usualCurrency: "EUR" },
      products: { savings: true, investments: false, homeInsurance: true, carInsurance: true, travelInsurance: false, mortgage: true },
      checking: 3100, savingsBalance: 12800, daysToPayday: 11, billsDueInDays: 4, upcomingOutflows: 1100, dailySpend: 60, salaryPrev: 4200, salaryNow: 4200, savingsIdleDays: 142,
      recent: [{ daysAgo: 2, label: "Aldi Kessel-Lo", amount: -88.1 }, { daysAgo: 4, label: "Total fuel", amount: -71 }],
    }),
  },
  {
    id: -4,
    emoji: "👵",
    label: "Retiree · bill paid twice",
    story: "The water bill went out twice this week. She's also paying a new payee, small and ordinary, so KBC doesn't cry wolf.",
    customer: base({
      id: -4, name: "Maria Claes", age: 78, segment: "retiree",
      baseline: { monthlyIncome: 1900, typicalMaxPayment: 450, usualCountry: "BE", usualHours: [8, 20], appSessionsPerWeek: 2, knownPayees: 11, usualCurrency: "EUR" },
      products: { savings: true, investments: true, homeInsurance: true, carInsurance: false, travelInsurance: false, mortgage: false },
      preferredChannel: "advisor",
      checking: 2300, savingsBalance: 21000, daysToPayday: 12, billsDueInDays: 6, upcomingOutflows: 420, dailySpend: 35, salaryPrev: 1900, salaryNow: 1900, savingsIdleDays: 30,
      recent: [
        { daysAgo: 1, label: "De Watergroep", amount: -86, tag: "bill" },
        { daysAgo: 3, label: "De Watergroep", amount: -86, tag: "bill" },
        { daysAgo: 4, label: "Apotheek Claes", amount: -12.6 },
      ],
      session: {
        device: "known", activeCall: false, hour: 11, country: "BE", hesitationSec: 9, attempts: 1,
        attempt: { payee: { name: "Kapsalon Mieke", iban: "BE68 5390 0754 7034", firstSeenDaysAgo: 0 }, amount: 45, currency: "EUR", note: "knippen" },
      },
    }),
  },
  {
    id: -5,
    emoji: "👶",
    label: "New parent · all good",
    story: "Busy life, finances fine. A baby shop payment is there, and KBC deliberately ignores it. Kate stays silent.",
    customer: base({
      id: -5, name: "Sofie Maes", age: 33, segment: "family",
      baseline: { monthlyIncome: 3600, typicalMaxPayment: 1100, usualCountry: "BE", usualHours: [6, 24], appSessionsPerWeek: 7, knownPayees: 27, usualCurrency: "EUR" },
      products: { savings: true, investments: true, homeInsurance: true, carInsurance: true, travelInsurance: true, mortgage: true },
      checking: 2900, savingsBalance: 6200, daysToPayday: 8, billsDueInDays: 3, upcomingOutflows: 1350, dailySpend: 55, salaryPrev: 3600, salaryNow: 3600, savingsIdleDays: 12,
      interruptionsThisWeek: 1,
      recent: [
        { daysAgo: 1, label: "Dreambaby Leuven", amount: -142 },
        { daysAgo: 2, label: "IKEA Zaventem", amount: -89, tag: "furniture" },
        { daysAgo: 3, label: "Delhaize", amount: -76.3 },
      ],
    }),
  },
];

export function getCustomer(id: number): Customer {
  const h = HEROES.find((x) => x.id === id);
  return h ? h.customer : generateCustomer(id);
}
