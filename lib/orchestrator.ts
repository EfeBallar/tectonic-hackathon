// Decision policy: one best action per customer, or none. Every "no" has a reason.
// Order: confidence threshold, consent, contact budget, then priority protect > support > guide.

import { detectAll, MOMENT_BY_ID, type Detection, type MomentId } from "./moments";
import type { Channel, Customer } from "./population";

export const POLICY = {
  minConfidence: 0.6,
  contactBudgetDays: 7, // max 1 non-protective proactive message per 7 days
};

export type HoldReason = "low_confidence" | "no_consent" | "contact_budget" | "lower_priority";

export interface Held {
  momentId: MomentId;
  reason: HoldReason;
  text: string;
}

export interface Decision {
  customerId: number;
  detections: Detection[];
  chosen: { momentId: MomentId; channel: Channel; confidence: number; reason: string } | null;
  held: Held[];
  checks: string[]; // policy checks the chosen action passed
}

const PRIORITY = { protect: 0, support: 1, guide: 2 } as const;

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

export function decide(c: Customer, detections: Detection[] = detectAll(c)): Decision {
  const held: Held[] = [];
  const eligible: Detection[] = [];

  for (const d of detections) {
    const m = MOMENT_BY_ID[d.momentId];
    if (d.confidence < POLICY.minConfidence) {
      held.push({ momentId: d.momentId, reason: "low_confidence", text: `Confidence ${pct(d.confidence)} is below ${pct(POLICY.minConfidence)}: not sure enough to act` });
      continue;
    }
    if (m.commercial && !c.consent.personalizedOffers) {
      held.push({ momentId: d.momentId, reason: "no_consent", text: "Customer switched off personalized offers" });
      continue;
    }
    if (m.pillar !== "protect" && c.lastContactedDaysAgo < POLICY.contactBudgetDays) {
      held.push({ momentId: d.momentId, reason: "contact_budget", text: `Already contacted ${c.lastContactedDaysAgo} day(s) ago; budget is 1 message per ${POLICY.contactBudgetDays} days` });
      continue;
    }
    eligible.push(d);
  }

  eligible.sort((a, b) => PRIORITY[MOMENT_BY_ID[a.momentId].pillar] - PRIORITY[MOMENT_BY_ID[b.momentId].pillar] || b.confidence - a.confidence);
  const [top, ...rest] = eligible;
  for (const d of rest) held.push({ momentId: d.momentId, reason: "lower_priority", text: `Waiting behind "${MOMENT_BY_ID[top.momentId].label}": one message at a time` });

  if (!top) return { customerId: c.id, detections, chosen: null, held, checks: [] };

  const m = MOMENT_BY_ID[top.momentId];
  const channel = pickChannel(c, top.momentId);
  const checks = [
    `Confidence ${pct(top.confidence)} ≥ ${pct(POLICY.minConfidence)}`,
    m.commercial ? "Customer consented to personalized offers" : "Not commercial: no offer consent needed",
    m.pillar === "protect" ? "Protective: always allowed, bypasses contact budget" : `Last contact ${c.lastContactedDaysAgo} days ago, within budget`,
    `Priority: ${m.pillar}`,
  ];
  const reason =
    channel === "advisor" ? "Big life moment: a human advisor, with an AI-prepared brief"
    : m.realtime ? "Live: shown inside the payment flow, before money leaves"
    : `Channel fits their behavior (${c.appSessionsLast7} app sessions this week, prefers ${c.preferredChannel})`;
  return { customerId: c.id, detections, chosen: { momentId: top.momentId, channel, confidence: top.confidence, reason }, held, checks };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
