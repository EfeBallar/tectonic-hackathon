// Nightly pass aggregation. Customers are never stored: we regenerate them from their id,
// so memory stays flat at 2.3M. Only counts, sums and a few sample ids are kept.

import { assessPayment, MOMENT_BY_ID, projectedGap, type MomentId } from "./moments";
import { decide, type Decision, type HoldReason } from "./orchestrator";
import { generateCustomer, type Channel, type Customer } from "./population";

export interface Consent {
  personalizedOffers: boolean;
  push: boolean;
  advisor: boolean;
  muted?: string[];
}

/** What the live demo changed for one customer: consent toggles and learned relevance. */
export interface Patch {
  consent?: Consent;
  relevance?: Record<string, number>;
}

export type SampleKey = MomentId | "none" | HoldReason;

export interface PassStats {
  scanned: number;
  withAction: number;
  none: number;
  detected: number; // customers with at least one detection
  moments: number; // total detections
  chosen: Partial<Record<MomentId, number>>;
  detectedBy: Partial<Record<MomentId, number>>;
  held: Partial<Record<HoldReason, number>>;
  channels: Partial<Record<Channel, number>>;
  impact: { scamEurPaused: number; scamsPaused: number; overdraftsCaught: number; idleEur: number; duplicateEur: number };
  samples: Partial<Record<SampleKey, number[]>>;
  ms: number;
}

export function emptyStats(): PassStats {
  return {
    scanned: 0, withAction: 0, none: 0, detected: 0, moments: 0, chosen: {}, detectedBy: {}, held: {}, channels: {},
    impact: { scamEurPaused: 0, scamsPaused: 0, overdraftsCaught: 0, idleEur: 0, duplicateEur: 0 },
    samples: {}, ms: 0,
  };
}

const MAX_SAMPLES = 40;
const inc = <K extends string>(o: Partial<Record<K, number>>, k: K, by: number) => { o[k] = (o[k] || 0) + by; };
function sample(s: PassStats, k: SampleKey, id: number) {
  const arr = (s.samples[k] ||= []);
  if (arr.length < MAX_SAMPLES && !arr.includes(id)) arr.push(id);
}

export function applyPatch(c: Customer, p?: Patch): Customer {
  if (!p) return c;
  return { ...c, consent: p.consent ?? c.consent, relevance: { ...c.relevance, ...p.relevance } };
}

/** Add (sign = 1) or remove (sign = -1) one customer's decision from the totals. */
export function accumulate(s: PassStats, c: Customer, d: Decision, sign: 1 | -1 = 1) {
  s.scanned += sign;
  if (d.detections.length) s.detected += sign;
  s.moments += sign * d.detections.length;
  for (const x of d.detections) inc(s.detectedBy, x.momentId, sign);
  for (const h of d.held) {
    inc(s.held, h.reason, sign);
    if (sign > 0) sample(s, h.reason, c.id);
  }
  if (!d.chosen) {
    s.none += sign;
    if (sign > 0 && d.detections.length === 0) sample(s, "none", c.id);
    return;
  }
  s.withAction += sign;
  inc(s.chosen, d.chosen.momentId, sign);
  inc(s.channels, d.chosen.channel, sign);
  if (sign > 0) sample(s, d.chosen.momentId, c.id);
  const im = s.impact;
  switch (d.chosen.momentId) {
    case "scam_in_progress": {
      const g = assessPayment(c);
      if (g && g.tier !== "allow") { im.scamsPaused += sign; im.scamEurPaused += sign * (c.session?.attempt?.amount ?? 0); }
      break;
    }
    case "cash_crunch": im.overdraftsCaught += sign; break;
    case "idle_cash": im.idleEur += sign * Math.max(0, c.savingsBalance - c.baseline.monthlyIncome * 6); break;
    case "duplicate_bill": {
      const b = c.recent.find((t) => t.tag === "bill");
      im.duplicateEur += sign * Math.abs(b?.amount ?? 0);
      break;
    }
  }
}

/** Run customers [from, to) into the stats. Returns elapsed ms. */
export function runChunk(s: PassStats, from: number, to: number, overrides: Map<number, Patch>, budget: number): number {
  const t0 = performance.now();
  for (let i = from; i < to; i++) {
    const c = applyPatch(generateCustomer(i), overrides.get(i));
    accumulate(s, c, decide(c, { budget }));
  }
  const ms = performance.now() - t0;
  s.ms += ms;
  return ms;
}

export function momentLabel(id: MomentId) {
  return MOMENT_BY_ID[id].label;
}

export { projectedGap };
