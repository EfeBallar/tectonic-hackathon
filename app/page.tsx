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
    <main className="flex min-h-[100dvh] flex-col-reverse lg:flex-row">
      <a href="#main" className="skip-link">Skip to the control room</a>
      <ControlRoom stats={stats} setStats={setStats} overrides={overrides} budget={budget} setBudget={setBudget} selectedId={selectedId} onSelect={setSelectedId} />
      <aside className="flex flex-col items-center gap-3 bg-page px-4 py-8 lg:sticky lg:top-0 lg:h-screen lg:w-[480px] lg:shrink-0 lg:overflow-y-auto">
        <div className="w-full max-w-[390px]">
          <h2 className="text-[20px] font-bold text-ink">Next morning, in {customer.name.split(" ")[0]}&apos;s app</h2>
          <p className="text-[14px] text-ink-2">{customer.age}, {customer.segment.replace("_", " ")}, {customer.city}. Synthetic customer.</p>
        </div>
        <MomentPhone key={selectedId} customer={customer} decision={decision} onConsent={onConsent} onFeedback={onFeedback} />
        <p className="max-w-[390px] text-center text-[12px] text-ink-3">Hackathon prototype, not an official KBC app.</p>
      </aside>
    </main>
  );
}
