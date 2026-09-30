// The exact same deterministic engine powers the browser demo and the authenticated Python API.
// stdin/stdout is a bounded JSON protocol; it never accepts code or shell commands.
import { readFileSync } from "node:fs";
import { HEROES } from "../lib/heroes";
import { MOMENT_BY_ID, forecast, type MomentId } from "../lib/moments";
import { decide } from "../lib/orchestrator";
import { reduce, type DemoAction } from "../lib/demoActions";
import { applyPatch } from "../lib/pass";
import type { Customer } from "../lib/population";

const input = JSON.parse(readFileSync(0, "utf8"));
if (input.op === "heroes") {
  process.stdout.write(JSON.stringify(HEROES.map(h => ({ ...h, customer_id: `H00${-h.id}` }))));
} else {
  let c: Customer = input.customer;
  if (!c || !Number.isFinite(c.checking)) throw new Error("Invalid customer snapshot");
  if (input.action) {
    const a = input.action as DemoAction;
    const selected = decide(c, { budget: input.budget ?? 3 }).chosen?.momentId;
    const id = a.kind === "scam" ? "scam_in_progress" : a.momentId;
    if (id !== selected) throw new Error("This moment is no longer selected. Refresh before acting.");
    const allowed = a.kind === "present" ||
      (a.kind === "dismiss" && id !== "scam_in_progress") ||
      (a.kind === "scam" && id === "scam_in_progress") ||
      (a.kind === "transfer_from_savings" && id === "cash_crunch") ||
      (a.kind === "refund" && id === "duplicate_bill") ||
      (a.kind === "goal" && ["idle_cash", "first_job", "salary_rise", "life_transition"].includes(id ?? "")) ||
      (a.kind === "cancel_payment" && id === "first_debit") ||
      (a.kind === "ack" && id !== "scam_in_progress");
    if (!allowed) throw new Error("Action is not available for this moment");
    if (a.kind === "refund") {
      const bill = c.recent.find(t => t.tag === "bill");
      if (!bill || Math.abs(bill.amount) !== a.amount || bill.label !== a.payee) throw new Error("Invalid refund request");
    }
    c = applyPatch(c, reduce(c, undefined, a));
  }
  const decision = decide(c, { budget: input.budget ?? 3 });
  const selected = decision.chosen?.momentId;
  const action = selected ? MOMENT_BY_ID[selected].action(c) : null;
  process.stdout.write(JSON.stringify({ customer: c, decision, action, forecast: forecast(c) }));
}
