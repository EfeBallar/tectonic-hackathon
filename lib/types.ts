// Shared types. The engine, the API routes and the UI all speak this.

export type Category =
  | "income"
  | "rent"
  | "groceries"
  | "eating_out"
  | "energy"
  | "telecom"
  | "subscriptions"
  | "transport"
  | "shopping"
  | "leisure"
  | "health"
  | "insurance"
  | "taxes"
  | "software"
  | "transfer"
  | "other";

export interface Transaction {
  id: string;
  date: string; // yyyy-mm-dd
  time?: string; // HH:MM
  merchant: string;
  amount: number; // negative = money out, positive = money in
  category: Category;
  country?: string; // ISO-2, default BE
  channel?: "card" | "online" | "direct_debit" | "transfer";
}

export interface ScheduledPayment {
  id: string;
  date: string;
  label: string;
  amount: number; // positive = outflow
  category: Category;
  source: "scheduled" | "predicted";
}

export interface Profile {
  id: string;
  name: string;
  age: number;
  blurb: string;
  segment: "young_pro" | "freelancer" | "student";
  paydayDay: number;
  incomeLabel: string; // "Salary", "Client payment", ...
  employer: string; // merchant name on the income transaction
  bufferTarget: number;
}

export interface Budget {
  id: string;
  category: Category;
  limit: number;
  createdAt: string;
}

export interface Goal {
  id: string;
  label: string;
  amount: number;
  date: string;
  perWeek: number;
  createdAt: string;
}

export interface Reminder {
  id: string;
  label: string;
  date: string;
}

export interface ActivityEntry {
  id: string;
  at: string; // ISO datetime
  title: string;
  detail?: string;
  origin: string; // "Insight: ..." / "Chat" / "Demo"
}

export interface FinState {
  today: string;
  profile: Profile;
  checking: number;
  savings: number;
  transactions: Transaction[]; // newest first
  scheduled: ScheduledPayment[]; // one-off known future payments
  budgets: Budget[];
  goals: Goal[];
  reminders: Reminder[];
  cardFrozen: boolean;
  reportedTx: string[];
  confirmedTx: string[];
  dismissed: string[];
  activity: ActivityEntry[];
}

export type ActionType =
  | "MOVE_TO_SAVINGS"
  | "TRANSFER_FROM_SAVINGS"
  | "CREATE_BUDGET"
  | "CREATE_GOAL"
  | "CREATE_REMINDER"
  | "FREEZE_CARD"
  | "UNFREEZE_CARD"
  | "MARK_AS_MINE"
  | "SHOW_TRANSACTIONS"
  | "DISMISS";

export interface ProposedAction {
  type: ActionType;
  label: string;
  params: Record<string, string | number | string[]>;
  primary?: boolean;
}

export type InsightKind =
  | "suspicious_payment"
  | "cash_crunch"
  | "spending_spike"
  | "price_increase"
  | "idle_cash";

export type Severity = "critical" | "warning" | "info" | "positive";

export interface Insight {
  id: string;
  kind: InsightKind;
  severity: Severity;
  title: string; // template text, always available
  summary: string; // template text, always available
  facts: Record<string, string | number>; // the ONLY numbers an LLM may use
  evidence: string[]; // transaction ids
  dataUsed: string[];
  dataNotUsed: string[];
  actions: ProposedAction[];
}

export interface ProjectionPoint {
  day: number; // 0 = today
  date: string;
  balance: number;
  events: { label: string; amount: number }[];
}

export interface Recurring {
  merchant: string;
  category: Category;
  lastAmount: number; // positive
  prevAmount: number; // positive
  lastDate: string;
  intervalDays: number;
  nextDate: string;
  count: number;
}

export interface CategoryStat {
  category: Category;
  last30: number;
  usual30: number;
  diff: number;
  pct: number;
  countLast30: number;
  countUsual30: number;
  topMerchants: { merchant: string; total: number; count: number }[];
}

export interface Analysis {
  nextPayday: string;
  daysToPayday: number;
  expectedIncome: number;
  dailyDiscretionary: number;
  upcoming: ScheduledPayment[]; // until payday
  projection: ProjectionPoint[];
  lowest: { day: number; date: string; balance: number };
  safeToSpend: number;
  safeToSpendBreakdown: { label: string; amount: number }[];
  recurring: Recurring[];
  categories: CategoryStat[];
  insights: Insight[];
}

// Chat / API contracts

export type Intent =
  | { kind: "affordability"; amount: number; date?: string; label?: string }
  | { kind: "explain_spending"; category?: Category }
  | { kind: "upcoming" }
  | { kind: "move_money"; amount: number; direction: "to_savings" | "from_savings" }
  | { kind: "general" };

export interface ToolResult {
  tool: string;
  facts: Record<string, string | number>;
  actions: ProposedAction[];
  card?: AnswerCard;
  templateText: string;
}

export type AnswerCard =
  | {
      type: "affordability";
      verdict: "comfortable" | "tight" | "not_yet";
      amount: number;
      label: string;
      date: string;
      rows: { label: string; value: number; emphasis?: boolean }[];
      plan?: string;
    }
  | { type: "breakdown"; title: string; rows: { label: string; value: number; note?: string }[] }
  | { type: "upcoming"; items: ScheduledPayment[] };

export interface AskResponse {
  text: string;
  actions: ProposedAction[];
  card?: AnswerCard;
  intent: Intent;
  facts: Record<string, string | number>;
  meta: {
    llmUsed: boolean;
    provider: string;
    model: string;
    guard: "passed" | "fallback_numbers" | "fallback_error" | "no_llm";
    ms: number;
  };
}

export interface ExplainResponse {
  headline: string;
  explanation: string;
  tip?: string;
  meta: AskResponse["meta"];
}
