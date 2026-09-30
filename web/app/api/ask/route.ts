import { NextResponse } from "next/server";
import { sanitizeActions } from "@/lib/actions";
import { checkNumbers } from "@/lib/guard";
import { llmConfig, llmJson } from "@/lib/llm";
import { answerPrompt, intentPrompt } from "@/lib/prompts";
import { parseIntentRegex, runTool } from "@/lib/tools";
import type { AskResponse, Category, FinState, Intent } from "@/lib/types";

export const runtime = "nodejs";

interface Body {
  question: string;
  state: FinState;
  history?: { role: "user" | "assistant"; text: string }[];
  lastIntent?: Intent;
}

const CATS: Category[] = ["groceries", "eating_out", "transport", "shopping", "leisure", "health"];

function coerceIntent(raw: Record<string, unknown>, fallback: Intent): Intent {
  const kind = raw.kind;
  const amount = typeof raw.amount === "number" && raw.amount > 0 ? raw.amount : undefined;
  const date = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : undefined;
  const label = typeof raw.label === "string" ? raw.label.slice(0, 40) : undefined;
  if (kind === "affordability" && amount) return { kind, amount, date, label };
  if (kind === "affordability" && fallback.kind === "affordability") return { ...fallback, date: date ?? fallback.date };
  if (kind === "explain_spending")
    return { kind, category: CATS.includes(raw.category as Category) ? (raw.category as Category) : undefined };
  if (kind === "upcoming") return { kind };
  if (kind === "move_money" && amount)
    return { kind, amount, direction: raw.direction === "from_savings" ? "from_savings" : "to_savings" };
  if (kind === "general") return { kind };
  return fallback;
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const body = (await req.json()) as Body;
  if (!body?.question || !body?.state) return NextResponse.json({ error: "question and state required" }, { status: 400 });
  const { question, state } = body;
  const { provider, model } = llmConfig();

  // 1. intent: regex always, LLM on top when available
  const regexIntent = parseIntentRegex(question, state.today, body.lastIntent);
  let intent = regexIntent;
  let llmUsed = false;
  if (provider !== "none") {
    try {
      const history = [...(body.history ?? []).slice(-6), { role: "user", text: question }]
        .map((m) => `${m.role}: ${m.text}`)
        .join("\n");
      const p = intentPrompt(state.today, history);
      const raw = await llmJson<Record<string, unknown>>(p.system, p.user);
      intent = coerceIntent(raw, regexIntent);
      llmUsed = true;
    } catch (e) {
      console.warn("[ask] intent LLM failed, using regex:", (e as Error).message);
    }
  }

  // 2. deterministic tool: the numbers come from HERE, never from the model
  const tool = runTool(state, intent);

  // 3. explanation
  let text = tool.templateText;
  let actions = tool.actions;
  let guard: AskResponse["meta"]["guard"] = "no_llm";
  if (provider !== "none") {
    try {
      const p = answerPrompt(question, tool.facts, tool.actions, state.profile.name);
      const out = await llmJson<{ text?: string; actions?: unknown }>(p.system, p.user);
      const candidate = (out.text ?? "").replace(/\s*—\s*/g, ", ").trim();
      const check = checkNumbers(candidate, tool.facts);
      if (candidate && check.ok) {
        text = candidate;
        actions = sanitizeActions(out.actions, tool.actions);
        guard = "passed";
        llmUsed = true;
      } else {
        guard = "fallback_numbers";
        console.warn("[ask] guard rejected LLM text, invented numbers:", check.offenders);
      }
    } catch (e) {
      guard = "fallback_error";
      console.warn("[ask] answer LLM failed:", (e as Error).message);
    }
  }

  const res: AskResponse = {
    text,
    actions,
    card: tool.card,
    intent,
    facts: tool.facts,
    meta: { llmUsed, provider, model, guard, ms: Date.now() - t0 },
  };
  return NextResponse.json(res);
}
