// The action layer. The assistant can only PROPOSE actions from this allowlist.
// Nothing touches money until the customer confirms in <ActionConfirmation />.

import type { ActionType, FinState, ProposedAction, Category } from "./types";
import { CATEGORY_LABEL, eur as eurFull, eur0, fmtDate, round2, uid } from "./util";

// whole euros without decimals, cents when they matter
const eur = (n: number) => (Number.isInteger(n) ? eur0(n) : eurFull(n));

// insights that disappear on their own once the numbers change (no need to hide them forever)
const SELF_RESOLVING = (id?: string) => !!id && (id === "crunch" || id === "idle_cash" || id.startsWith("fraud_"));

export const ALLOWED_ACTIONS: Record<ActionType, { needsConfirmation: boolean; description: string }> = {
  MOVE_TO_SAVINGS: { needsConfirmation: true, description: "Move {amount} EUR from checking to savings" },
  TRANSFER_FROM_SAVINGS: { needsConfirmation: true, description: "Move {amount} EUR from savings to checking" },
  CREATE_BUDGET: { needsConfirmation: true, description: "Create a monthly spending cap {limit} for {category}" },
  CREATE_GOAL: { needsConfirmation: true, description: "Create a savings goal {label} of {amount} by {date}" },
  CREATE_REMINDER: { needsConfirmation: true, description: "Set a reminder {label} on {date}" },
  FREEZE_CARD: { needsConfirmation: true, description: "Freeze the debit card and report transaction {txId}" },
  UNFREEZE_CARD: { needsConfirmation: true, description: "Unfreeze the debit card" },
  MARK_AS_MINE: { needsConfirmation: false, description: "Confirm transaction {txId} was made by the customer" },
  SHOW_TRANSACTIONS: { needsConfirmation: false, description: "Open the transaction list filtered by {category} or {merchants}" },
  DISMISS: { needsConfirmation: false, description: "Hide insight {insightId}" },
};

export function needsConfirmation(a: ProposedAction): boolean {
  return ALLOWED_ACTIONS[a.type]?.needsConfirmation ?? true;
}

/** Keep only actions that exist in the allowlist and have sane params. Used on anything an LLM returns. */
export function sanitizeActions(actions: unknown, allowed: ProposedAction[]): ProposedAction[] {
  if (!Array.isArray(actions)) return allowed;
  const out: ProposedAction[] = [];
  for (const a of actions) {
    if (!a || typeof a !== "object") continue;
    const type = (a as { type?: string }).type as ActionType;
    // The LLM may only pick from actions the engine already computed (same type AND params).
    const match = allowed.find((x) => x.type === type);
    if (!match) continue;
    const label = typeof (a as { label?: string }).label === "string" ? (a as { label: string }).label.slice(0, 60) : match.label;
    out.push({ ...match, label });
  }
  return out.length ? out : allowed;
}

/** Human description of what will happen, for the confirmation sheet. */
export function describeAction(a: ProposedAction, s: FinState): { title: string; lines: string[] } {
  const p = a.params;
  switch (a.type) {
    case "MOVE_TO_SAVINGS":
      return {
        title: `Move ${eur(Number(p.amount))} to savings`,
        lines: [`From: Checking (${eurFull(s.checking)})`, `To: Savings (${eurFull(s.savings)})`, "Arrives instantly"],
      };
    case "TRANSFER_FROM_SAVINGS":
      return {
        title: `Move ${eur(Number(p.amount))} to checking`,
        lines: [`From: Savings (${eurFull(s.savings)})`, `To: Checking (${eurFull(s.checking)})`, "Arrives instantly"],
      };
    case "CREATE_BUDGET":
      return {
        title: `Monthly cap: ${eur0(Number(p.limit))} on ${CATEGORY_LABEL[p.category as Category].toLowerCase()}`,
        lines: ["You'll get a nudge at 80% and when you hit the cap", "Payments are never blocked"],
      };
    case "CREATE_GOAL":
      return {
        title: `Savings goal: ${p.label}`,
        lines: [`Target: ${eur0(Number(p.amount))} by ${fmtDate(String(p.date))}`, `Suggested: ${eur0(Number(p.perWeek))}/week`],
      };
    case "CREATE_REMINDER":
      return { title: `Reminder: ${p.label}`, lines: [`On ${fmtDate(String(p.date), "long")}`] };
    case "FREEZE_CARD":
      return {
        title: "Freeze card & report payment",
        lines: ["Your debit card stops working immediately", "We'll open a dispute for this payment", "Unfreeze anytime in one tap"],
      };
    case "UNFREEZE_CARD":
      return { title: "Unfreeze card", lines: ["Your debit card works again immediately"] };
    default:
      return { title: a.label, lines: [] };
  }
}

export function applyAction(s: FinState, a: ProposedAction, origin: string, insightId?: string): FinState {
  const p = a.params;
  const now = new Date().toISOString();
  const next: FinState = {
    ...s,
    activity: [...s.activity],
    dismissed:
      insightId && a.type !== "SHOW_TRANSACTIONS" && !SELF_RESOLVING(insightId) ? [...s.dismissed, insightId] : [...s.dismissed],
  };
  const log = (title: string, detail?: string) =>
    next.activity.unshift({ id: uid("a"), at: now, title, detail, origin });

  switch (a.type) {
    case "MOVE_TO_SAVINGS": {
      const amt = Math.min(Number(p.amount), s.checking);
      next.checking = round2(s.checking - amt);
      next.savings = round2(s.savings + amt);
      next.transactions = [
        { id: uid("t"), date: s.today, time: now.slice(11, 16), merchant: "To savings account", amount: -amt, category: "transfer", channel: "transfer" },
        ...s.transactions,
      ];
      log(`Moved ${eur(amt)} to savings`);
      break;
    }
    case "TRANSFER_FROM_SAVINGS": {
      const amt = Math.min(Number(p.amount), s.savings);
      next.checking = round2(s.checking + amt);
      next.savings = round2(s.savings - amt);
      next.transactions = [
        { id: uid("t"), date: s.today, time: now.slice(11, 16), merchant: "From savings account", amount: amt, category: "transfer", channel: "transfer" },
        ...s.transactions,
      ];
      log(`Moved ${eur(amt)} from savings to checking`);
      break;
    }
    case "CREATE_BUDGET":
      next.budgets = [
        ...s.budgets.filter((b) => b.category !== p.category),
        { id: uid("b"), category: p.category as Category, limit: Number(p.limit), createdAt: s.today },
      ];
      log(`Set a ${eur0(Number(p.limit))} monthly cap`, CATEGORY_LABEL[p.category as Category]);
      break;
    case "CREATE_GOAL":
      next.goals = [
        ...s.goals,
        { id: uid("g"), label: String(p.label), amount: Number(p.amount), date: String(p.date), perWeek: Number(p.perWeek), createdAt: s.today },
      ];
      log(`Created goal "${p.label}"`, `${eur0(Number(p.amount))} by ${fmtDate(String(p.date))}`);
      break;
    case "CREATE_REMINDER":
      next.reminders = [...s.reminders, { id: uid("r"), label: String(p.label), date: String(p.date) }];
      log(`Reminder set for ${fmtDate(String(p.date))}`, String(p.label));
      break;
    case "FREEZE_CARD":
      next.cardFrozen = true;
      next.reportedTx = [...s.reportedTx, String(p.txId)];
      log("Card frozen and payment reported", "Dispute opened");
      break;
    case "UNFREEZE_CARD":
      next.cardFrozen = false;
      log("Card unfrozen");
      break;
    case "MARK_AS_MINE":
      next.confirmedTx = [...s.confirmedTx, String(p.txId)];
      log("Confirmed a payment as yours");
      break;
    case "DISMISS":
      next.dismissed = [...next.dismissed, String(p.insightId)];
      break;
    case "SHOW_TRANSACTIONS":
      break;
  }
  return next;
}
