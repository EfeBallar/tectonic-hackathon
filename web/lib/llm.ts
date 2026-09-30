// Provider-agnostic LLM call that returns parsed JSON. Plain fetch, zero SDKs.
// Server-only (reads API keys). If nothing is configured, callers fall back to templates.

export type Provider = "gemini" | "openai" | "anthropic" | "none";

const DEFAULT_MODEL: Record<Exclude<Provider, "none">, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
};

export function llmConfig(): { provider: Provider; model: string } {
  const forced = process.env.LLM_PROVIDER as Provider | undefined;
  const provider: Provider =
    forced && forced !== "none"
      ? forced
      : process.env.GEMINI_API_KEY
        ? "gemini"
        : process.env.OPENAI_API_KEY
          ? "openai"
          : process.env.ANTHROPIC_API_KEY
            ? "anthropic"
            : "none";
  if (provider === "none") return { provider, model: "templates" };
  return { provider, model: process.env.LLM_MODEL || DEFAULT_MODEL[provider] };
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("LLM did not return JSON");
  }
}

export async function llmJson<T = unknown>(system: string, user: string): Promise<T> {
  const { provider, model } = llmConfig();
  if (provider === "none") throw new Error("No LLM configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(process.env.LLM_TIMEOUT_MS || 12000));
  try {
    let text = "";
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      text = j.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    } else if (provider === "openai") {
      // OPENAI_BASE_URL lets you point at any OpenAI-compatible API (Groq, Together, Azure, a local model...)
      const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      text = j.choices?.[0]?.message?.content ?? "";
    } else if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          temperature: 0.4,
          system: system + "\nRespond with a single JSON object and nothing else.",
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = await res.json();
      text = j.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
    }
    return extractJson(text) as T;
  } finally {
    clearTimeout(timer);
  }
}
