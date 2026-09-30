import { NextResponse } from "next/server";
import { checkNumbers } from "@/lib/guard";
import { llmConfig, llmJson } from "@/lib/llm";
import { insightPrompt } from "@/lib/prompts";
import type { ExplainResponse, Insight } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const t0 = Date.now();
  const { insight, name } = (await req.json()) as { insight: Insight; name: string };
  if (!insight) return NextResponse.json({ error: "insight required" }, { status: 400 });
  const { provider, model } = llmConfig();
  const fallback: ExplainResponse = {
    headline: insight.title,
    explanation: insight.summary,
    meta: { llmUsed: false, provider, model, guard: "no_llm", ms: 0 },
  };
  if (provider === "none") return NextResponse.json({ ...fallback, meta: { ...fallback.meta, ms: Date.now() - t0 } });
  try {
    const p = insightPrompt(insight.title, insight.summary, insight.facts, name);
    const out = await llmJson<{ headline?: string; explanation?: string; tip?: string }>(p.system, p.user);
    const clean = (x?: string) => (x ?? "").replace(/\s*—\s*/g, ", ").trim();
    const all = [out.headline, out.explanation, out.tip].map(clean).join(" ");
    const check = checkNumbers(all, insight.facts);
    if (!check.ok || !out.explanation) {
      console.warn("[explain] guard rejected:", check.offenders);
      return NextResponse.json({ ...fallback, meta: { ...fallback.meta, guard: "fallback_numbers", ms: Date.now() - t0 } });
    }
    const res: ExplainResponse = {
      headline: clean(out.headline) || insight.title,
      explanation: clean(out.explanation),
      tip: clean(out.tip) || undefined,
      meta: { llmUsed: true, provider, model, guard: "passed", ms: Date.now() - t0 },
    };
    return NextResponse.json(res);
  } catch (e) {
    console.warn("[explain] LLM failed:", (e as Error).message);
    return NextResponse.json({ ...fallback, meta: { ...fallback.meta, guard: "fallback_error", ms: Date.now() - t0 } });
  }
}
