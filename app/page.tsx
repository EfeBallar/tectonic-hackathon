"use client";

import { useMemo, useState } from "react";
import { ControlRoom } from "@/components/ControlRoom";
import { MomentPhone } from "@/components/MomentPhone";
import { decide } from "@/lib/orchestrator";
import { accumulate, withConsent, type Consent, type PassStats } from "@/lib/pass";
import { findExample, generateCustomer } from "@/lib/population";

// Hero customer for the opening shot: a scam call in progress.
const HERO = findExample("scam_call")?.id ?? 0;

export default function Page() {
  const [stats, setStats] = useState<PassStats | null>(null);
  const [overrides, setOverrides] = useState<Map<number, Consent>>(() => new Map());
  const [selectedId, setSelectedId] = useState<number>(HERO);

  const customer = useMemo(() => withConsent(generateCustomer(selectedId), overrides.get(selectedId)), [selectedId, overrides]);
  const decision = useMemo(() => decide(customer), [customer]);

  // Privacy toggle: re-decide this customer live and patch the control room totals.
  function onConsent(consent: Consent) {
    const next = new Map(overrides);
    next.set(selectedId, consent);
    setOverrides(next);
    if (stats && selectedId < stats.scanned) {
      const s: PassStats = structuredClone(stats);
      accumulate(s, customer, decision, -1);
      const updated = withConsent(customer, consent);
      accumulate(s, updated, decide(updated), 1);
      setStats(s);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[1500px] flex-col-reverse items-start gap-6 p-4 lg:flex-row lg:p-6">
      <ControlRoom stats={stats} setStats={setStats} overrides={overrides} selectedId={selectedId} onSelect={setSelectedId} />
      <div className="sticky top-6 flex flex-col items-center gap-2 self-center lg:self-start">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">Customer side · {customer.name}, {customer.age}, {customer.segment.replace("_", " ")}</div>
        <MomentPhone key={selectedId} customer={customer} decision={decision} onConsent={onConsent} />
        <div className="max-w-[390px] text-center text-[11px] text-ink-3">Hackathon prototype. Not an official KBC app. All customers are synthetic.</div>
      </div>
    </main>
  );
}
