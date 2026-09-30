// GDPR Art. 9: special category data. Transactions can reveal health, religion, politics,
// union membership, sexual orientation, pregnancy. The engine never infers any of that:
// matching transactions are removed before any non-protective detector runs.
// Only fraud prevention (the "protect" pillar) may still see them, e.g. a fake pharmacy webshop.

import type { Customer, SignalTx } from "./population";

export type SensitiveCategory = "health" | "pregnancy_baby" | "religion" | "politics" | "union" | "sexual_orientation" | "gambling";

export const SENSITIVE_RULES: { category: SensitiveCategory; label: string; match: RegExp }[] = [
  { category: "health", label: "Health", match: /apothe|pharma|ziekenhuis|hospital|huisarts|dokter|tandarts|kinesist|psycholo|mutualiteit|ziekenfonds|cm |helan|solidaris|labo/i },
  { category: "pregnancy_baby", label: "Pregnancy or baby", match: /dreambaby|baby|prenata|kraam|zwanger|maternity|pampers/i },
  { category: "religion", label: "Religion", match: /kerk|church|moskee|mosque|synago|parochie|diocese|zakat/i },
  { category: "politics", label: "Politics", match: /n-va|vooruit|groen|open vld|cd&v|vlaams belang|pvda|partij|party donation/i },
  { category: "union", label: "Union membership", match: /acv|abvv|aclvb|vakbond|union dues/i },
  { category: "sexual_orientation", label: "Sexual orientation", match: /pride|lgbt|çavaria|cavaria|grindr/i },
  { category: "gambling", label: "Gambling (protective help only)", match: /betnow|napoleon|ladbrokes|unibet|bwin|casino|betfirst/i },
];

export function sensitiveCategory(t: SignalTx): SensitiveCategory | null {
  for (const r of SENSITIVE_RULES) if (r.match.test(t.label)) return r.category;
  return null;
}

/** The customer as non-protective detectors see them: sensitive transactions removed. */
export function masked(c: Customer): { view: Customer; hidden: { tx: SignalTx; category: SensitiveCategory }[] } {
  const hidden: { tx: SignalTx; category: SensitiveCategory }[] = [];
  const recent = c.recent.filter((t) => {
    const cat = sensitiveCategory(t);
    if (cat) hidden.push({ tx: t, category: cat });
    return !cat;
  });
  return { view: hidden.length ? { ...c, recent } : c, hidden };
}
