// Decision policy: the Attention Budget.
// Each customer has a small weekly budget of interruptions. Every detected moment competes for a slot:
//   priority = urgency × confidence × relevance(to this customer) − interruption cost
// Only the top moment is shown; the rest wait. Protection is never rationed: scam and fraud
// moments bypass the budget. Every "no" has a human-readable reason.

import { detectAll, MOMENT_BY_ID, type Detection, type MomentId } from "./moments";
import type { Channel, Customer } from "./population";

export const POLICY = {
  minConfidence: 0.6, // below this we don't act (ambiguous signals stay silent)
  weeklyBudget: 3, // proactive interruptions per customer per week (PM: "for example 3")
  minPriority: 0.08, // not worth an interruption below this
};

/** How bad is waiting (0..1), and how much an interruption of this kind costs (0..1). Tune here. */
export const SCORING: Record<MomentId, { urgency: number; cost: number }> = {
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
};

export type HoldReason = "low_confidence" | "no_consent" | "muted" | "budget_full" | "not_worth_it" | "lower_priority";

export interface Held {
  momentId: MomentId;
  reason: HoldReason;
  text: string;
  priority?: number;
}

export interface Scored {
  momentId: MomentId;
  confidence: number;
  urgency: number;
  relevance: number;
  cost: number;
  priority: number;
  bypass: boolean;
}

export interface Decision {
  customerId: number;
  detections: Detection[];
  ranked: Scored[];
  chosen: { momentId: MomentId; channel: Channel; confidence: number; priority: number; reason: string } | null;
  held: Held[];
  checks: string[]; // policy checks the chosen action passed
  budget: { used: number; size: number };
}

export function pickChannel(c: Customer, momentId: MomentId): Channel {
  const m = MOMENT_BY_ID[momentId];
  if (m.pillar === "protect") return m.realtime && c.session?.attempt ? "app" : c.consent.push ? "push" : "app";
  if (m.bigMoment && c.consent.advisor) return "advisor";
  // behavior signal: if they barely open the app, don't wait for them there
  const appActive = c.appSessionsLast7 >= 1;
  if (c.preferredChannel === "push" && !c.consent.push) return appActive ? "app" : "email";
  if (c.preferredChannel === "advisor" && !c.consent.advisor) return appActive ? "app" : "email";
  if ((c.preferredChannel === "app" || c.preferredChannel === "kate") && !appActive) return "email";
  return c.preferredChannel;
}

export function score(c: Customer, d: Detection): Scored {
  const m = MOMENT_BY_ID[d.momentId];
  const { urgency, cost } = SCORING[d.momentId];
  const relevance = c.relevance[d.momentId] ?? 1;
  const priority = Math.round((urgency * d.confidence * relevance - cost) * 1000) / 1000;
  return { momentId: d.momentId, confidence: d.confidence, urgency, relevance, cost, priority, bypass: m.pillar === "protect" };
}

export function decide(c: Customer, opts: { budget?: number } = {}, all: Detection[] = detectAll(c)): Decision {
  // moments the customer already acted on or dismissed this week don't come back
  const detections = c.resolved?.length ? all.filter((d) => !c.resolved!.includes(d.momentId)) : all;
  const size = opts.budget ?? POLICY.weeklyBudget;
  const used = c.interruptionsThisWeek;
  const held: Held[] = [];
  const ranked = detections.map((d) => score(c, d)).sort((a, b) => Number(b.bypass) - Number(a.bypass) || b.priority - a.priority);
  const eligible: Scored[] = [];

  for (const s of ranked) {
    const m = MOMENT_BY_ID[s.momentId];
    const p = s.priority;
    if (s.confidence < POLICY.minConfidence) {
      held.push({ momentId: s.momentId, reason: "low_confidence", priority: p, text: `Confidence ${pct(s.confidence)} is below ${pct(POLICY.minConfidence)}: not sure enough, so we stay quiet` });
    } else if (!s.bypass && c.consent.muted?.includes(s.momentId)) {
      held.push({ momentId: s.momentId, reason: "muted", priority: p, text: "You turned this kind of message off" });
    } else if (m.commercial && !c.consent.personalizedOffers) {
      held.push({ momentId: s.momentId, reason: "no_consent", priority: p, text: "You switched off personalized offers" });
    } else if (!s.bypass && used >= size) {
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
    `Confidence ${pct(top.confidence)} ≥ ${pct(POLICY.minConfidence)}`,
    `Priority ${top.priority.toFixed(2)} = urgency ${top.urgency} × confidence ${top.confidence} × relevance ${top.relevance.toFixed(2)} − cost ${top.cost}`,
    m.commercial ? "You consented to personalized offers" : "Not commercial: no offer consent needed",
    top.bypass ? "Protection: bypasses the attention budget" : `Attention budget: ${used} of ${size} used this week`,
  ];
  const reason =
    channel === "advisor" ? "Big life moment: a human advisor, with an AI-prepared brief"
    : m.realtime ? "Live: shown inside the payment flow, before money leaves"
    : `Fits their behavior (${c.appSessionsLast7} app sessions this week, prefers ${c.preferredChannel})`;
  return { customerId: c.id, detections, ranked, chosen: { momentId: top.momentId, channel, confidence: top.confidence, priority: top.priority, reason }, held, checks, budget };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
