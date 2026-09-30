// Browser-only version of /api/ask: regex intent + engine tool + template sentence.
// Used by the static preview, and as a fallback if the API route is unreachable.
import { parseIntentRegex, runTool } from "./tools";
import type { AskResponse, FinState, Intent } from "./types";

export function localAsk(question: string, state: FinState, lastIntent?: Intent): AskResponse {
  const t0 = Date.now();
  const intent = parseIntentRegex(question, state.today, lastIntent);
  const tool = runTool(state, intent);
  return {
    text: tool.templateText,
    actions: tool.actions,
    card: tool.card,
    intent,
    facts: tool.facts,
    meta: { llmUsed: false, provider: "none", model: "templates", guard: "no_llm", ms: Date.now() - t0 },
  };
}
