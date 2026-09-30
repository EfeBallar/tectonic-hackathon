"use client";

import { useMemo, useState } from "react";
import { ControlRoom } from "@/components/ControlRoom";
import { MomentPhone } from "@/components/MomentPhone";
import { decide, POLICY } from "@/lib/orchestrator";
import { accumulate, applyPatch, type Consent, type Patch, type PassStats } from "@/lib/pass";
import { getCustomer, HEROES } from "@/lib/heroes";

const HERO = HEROES[0].id;

export default function Page() {
  const [stats, setStats] = useState<PassStats | null>(null);
  const [overrides, setOverrides] = useState<Map<number, Patch>>(() => new Map());
  const [budget, setBudget] = useState(POLICY.weeklyBudget);
  const [selectedId, setSelectedId] = useState<number>(HERO);

  const customer = useMemo(() => applyPatch(getCustomer(selectedId), overrides.get(selectedId)), [selectedId, overrides]);
  const decision = useMemo(() => decide(customer, { budget }), [customer, budget]);

  // Privacy toggle or feedback: re-decide this customer live and patch the control room totals.
  function patch(p: Patch) {
    const merged: Patch = { ...overrides.get(selectedId), ...p, relevance: { ...overrides.get(selectedId)?.relevance, ...p.relevance } };
    const next = new Map(overrides);
    next.set(selectedId, merged);
    setOverrides(next);
    if (stats && selectedId >= 0 && selectedId < stats.scanned) {
      const s: PassStats = structuredClone(stats);
      accumulate(s, customer, decision, -1);
      const updated = applyPatch(getCustomer(selectedId), merged);
      accumulate(s, updated, decide(updated, { budget }), 1);
      setStats(s);
    }
  }
  const onConsent = (consent: Consent) => patch({ consent });
  // Feedback loop: dismissing a kind of moment lowers its relevance for this customer.
  const onFeedback = (momentId: string, acted: boolean) => {
    const cur = customer.relevance[momentId] ?? 1;
    patch({ relevance: { [momentId]: Math.max(0.1, Math.min(1.5, cur * (acted ? 1.15 : 0.5))) } });
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-[1500px] flex-col-reverse items-start gap-6 p-4 lg:flex-row lg:p-6">
      <ControlRoom stats={stats} setStats={setStats} overrides={overrides} budget={budget} setBudget={setBudget} selectedId={selectedId} onSelect={setSelectedId} />
      <div className="sticky top-6 flex flex-col items-center gap-2 self-center lg:self-start">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">Customer side · {customer.name}, {customer.age}, {customer.segment.replace("_", " ")}</div>
        <MomentPhone key={selectedId} customer={customer} decision={decision} onConsent={onConsent} onFeedback={onFeedback} />
        <div className="max-w-[390px] text-center text-[11px] text-ink-3">Hackathon prototype. Not an official KBC app. All customers are synthetic.</div>
      </div>
    </main>
  );
}
