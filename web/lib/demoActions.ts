// What the customer's taps actually do in the demo. Pure functions over in-memory synthetic state:
// no backend, no real money. Amounts are validated and clamped; unknown kinds are ignored.

import { MOMENT_BY_ID, type MomentId } from "./moments";
import type { Patch } from "./pass";
import type { Customer } from "./population";

export type DemoAction =
  | { kind: "present"; momentId: MomentId }
  | { kind: "cancel_payment"; momentId: MomentId; paymentId: string }
  | { kind: "transfer_from_savings"; momentId: MomentId; amount: number }
  | { kind: "refund"; momentId: MomentId; amount: number; payee: string }
  | { kind: "scam"; outcome: "cancelled" | "delayed" | "handoff" }
  | { kind: "goal"; momentId: MomentId; label: string; target: number; monthly: number; fromIdle: number; shape: NonNullable<Customer["goal"]>["shape"] }
  | { kind: "ack"; momentId: MomentId; text: string }
  | { kind: "dismiss"; momentId: MomentId };

const eur = (n: number) => `€${Math.round(n).toLocaleString("nl-BE")}`;
const money = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : 0);

export function reduce(c: Customer, prev: Patch | undefined, a: DemoAction): Patch {
  const p: Patch = { ...prev };
  const resolve = (id: string) => { p.resolved = [...(p.resolved ?? []), id]; };
  const log = (t: string) => { p.log = [t, ...(p.log ?? [])].slice(0, 20); };
  const spendSlot = (id: MomentId) => {
    const shown = p.presented ?? c.presented ?? [];
    if (shown.includes(id)) return;
    p.presented = [...shown, id];
    if (MOMENT_BY_ID[id]?.pillar !== "protect") p.used = (p.used ?? 0) + 1;
  };
  // learned relevance: acting on a kind of moment raises it, dismissing it halves it
  const learn = (id: string, acted: boolean) => {
    const cur = c.relevance[id] ?? 1;
    p.relevance = { ...p.relevance, [id]: Math.max(0.1, Math.min(1.5, cur * (acted ? 1.15 : 0.5))) };
  };
  if ("momentId" in a && a.kind !== "present") learn(a.momentId, a.kind !== "dismiss");

  switch (a.kind) {
    case "present":
      spendSlot(a.momentId);
      return p;
    case "cancel_payment": {
      const due = c.scheduledPayments?.find(x => x.id === a.paymentId && !x.cancelled);
      if (!due) return p;
      p.scheduledPayments = c.scheduledPayments!.map(x => x.id === a.paymentId ? { ...x, cancelled: true } : x);
      resolve(a.momentId); spendSlot(a.momentId);
      log(`Cancelled the scheduled ${eur(due.amount)} payment to ${due.label} in this synthetic account.`);
      return p;
    }
    case "transfer_from_savings": {
      const amt = Math.min(money(a.amount), c.savingsBalance); // never more than they have
      if (amt <= 0) return p;
      p.balances = { checking: c.checking + amt, savings: c.savingsBalance - amt };
      resolve(a.momentId); spendSlot(a.momentId);
      log(`Moved ${eur(amt)} from savings to your current account. Reminder set to move it back on payday.`);
      return p;
    }
    case "refund":
      resolve(a.momentId); spendSlot(a.momentId);
      log(`Refund requested: ${eur(money(a.amount))} from ${a.payee}. Usually back within 5 working days.`);
      return p;
    case "scam": {
      const at = c.session?.attempt;
      resolve("scam_in_progress");
      if (!at) return p;
      if (a.outcome === "cancelled") log(`Payment of ${eur(at.amount)} to “${at.payee.name}” cancelled. The money never left.`);
      if (a.outcome === "delayed") log(`Payment of ${eur(at.amount)} held for 24 hours. You can still cancel it until then.`);
      if (a.outcome === "handoff") log(`Payment of ${eur(at.amount)} held while you talked to the KBC fraud team (simulated in this demo).`);
      return p;
    }
    case "goal": {
      const target = Math.max(1, money(a.target));
      const available = c.savingsBalance + (c.goal?.saved ?? 0);
      const fromIdle = Math.min(money(a.fromIdle), available, target);
      p.goal = { label: a.label, target, monthly: money(a.monthly), saved: fromIdle, shape: a.shape };
      p.balances = { checking: c.checking, savings: available - fromIdle };
      resolve(a.momentId); spendSlot(a.momentId);
      log(`Goal “${a.label}” started with ${eur(fromIdle)}. ${eur(a.monthly)} goes in every payday.`);
      return p;
    }
    case "ack":
      resolve(a.momentId); spendSlot(a.momentId);
      log(a.text);
      return p;
    case "dismiss":
      resolve(a.momentId);
      spendSlot(a.momentId);
      log(`Hid “${MOMENT_BY_ID[a.momentId]?.label}”. You'll see this kind of message less often.`);
      return p;
    default:
      return p;
  }
}
