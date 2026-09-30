// Hallucination guard: every number the LLM writes must come from the engine's facts.
// If the model invents a figure, we throw its text away and use the template sentence.
// This is a great thing to say out loud in the pitch.

function normalize(tok: string): number | null {
  let t = tok.replace(/[€%]/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, ""); // 1,140.22
  else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", "."); // 1.140,22
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function factNumbers(facts: Record<string, string | number>): number[] {
  const out: number[] = [];
  for (const v of Object.values(facts)) {
    if (typeof v === "number") {
      out.push(Math.abs(v));
    } else {
      for (const m of v.match(/\d[\d.,]*/g) ?? []) {
        const n = normalize(m.replace(/[.,]$/, ""));
        if (n !== null) out.push(Math.abs(n));
      }
    }
  }
  return out;
}

export function checkNumbers(text: string, facts: Record<string, string | number>): { ok: boolean; offenders: number[] } {
  const allowed = factNumbers(facts);
  const offenders: number[] = [];
  for (const raw of text.match(/\d[\d.,]*/g) ?? []) {
    const n = normalize(raw.replace(/[.,]$/, ""));
    if (n === null) continue;
    if (Number.isInteger(n) && n <= 31) continue; // dates, counts, "3 payments"
    if (n >= 2020 && n <= 2035) continue; // years
    const ok = allowed.some((f) => Math.abs(f - n) <= Math.max(1, f * 0.02));
    if (!ok) offenders.push(n);
  }
  return { ok: offenders.length === 0, offenders };
}
