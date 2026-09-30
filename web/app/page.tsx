"use client";

import { useMemo, useState } from "react";
import { ControlRoom } from "@/components/ControlRoom";
import { MomentPhone } from "@/components/MomentPhone";
import { AttentionRace } from "@/components/AttentionRace";
import { LiveBank } from "@/components/LiveBank";
import { MOMENT_BY_ID } from "@/lib/moments";
import { decide, POLICY } from "@/lib/orchestrator";
import { accumulate, applyPatch, type Consent, type Patch, type PassStats } from "@/lib/pass";
import { getCustomer, HEROES } from "@/lib/heroes";
import { reduce, type DemoAction } from "@/lib/demoActions";

const HERO = HEROES[0].id;

export default function Page() {
  const [stats, setStats] = useState<PassStats | null>(null);
  const [overrides, setOverrides] = useState<Map<number, Patch>>(() => new Map());
  const [budget, setBudget] = useState(POLICY.weeklyBudget);
  const [selectedId, setSelectedId] = useState<number>(HERO);
  const [view, setView] = useState<"customer" | "live" | "kbc">("customer");
  const openCustomer = (id: number) => { setSelectedId(id); setView("customer"); };

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
  // Customer taps: a real (synthetic, in-memory) state change, kept when switching customers.
  const onAct = (a: DemoAction) => patch(reduce(customer, overrides.get(selectedId), a));

  const first = customer.name.split(" ")[0];
  const live = decision.chosen && MOMENT_BY_ID[decision.chosen.momentId].realtime;

  return (
    <div className="min-h-[100dvh]">
      <a href="#main" className="skip-link">Skip to content</a>
      <nav className={`sticky top-0 z-40 flex items-center justify-between gap-4 px-5 py-3 lg:px-10 ${view === "kbc" ? "bg-night text-white" : "bg-page text-ink"}`}>
        <span className="text-[15px] font-bold">KBC personalization prototype</span>
        <div role="tablist" aria-label="Side" className={`flex rounded-lg p-1 ${view === "kbc" ? "bg-white/10" : "bg-white"}`}>
          {([["customer", "Customer"], ["live", "Live (GCP)"], ["kbc", "KBC"]] as const).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-4 py-1.5 text-[14px] font-semibold ${view === v ? (v === "kbc" ? "bg-signal text-night" : "bg-brand text-white") : "opacity-70 hover:opacity-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {view === "live" ? (
        <LiveBank />
      ) : view === "kbc" ? (
        <main id="main" className="flex">
          <ControlRoom stats={stats} setStats={setStats} overrides={overrides} budget={budget} setBudget={setBudget} selectedId={selectedId} onSelect={openCustomer} />
        </main>
      ) : (
        <main id="main" className="mx-auto grid max-w-[1200px] items-start gap-8 px-5 pb-10 pt-4 lg:grid-cols-[minmax(0,0.9fr)_390px_minmax(0,1.1fr)] lg:px-10">
          <section aria-label="Customers" className="order-2 lg:order-1">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Five people, five different mornings</h1>
            <p className="mt-2 max-w-sm text-[15px] text-ink-2">Same engine, same rules. Pick someone and their app adapts to what is going on in their life.</p>
            <ul className="mt-5 space-y-1">
              {HEROES.map((h) => {
                const on = selectedId === h.id;
                return (
                  <li key={h.id}>
                    <button
                      onClick={() => setSelectedId(h.id)}
                      className={`w-full rounded-lg px-3 py-2.5 text-left ${on ? "bg-brand text-white" : "hover:bg-white"}`}
                    >
                      <span className="block text-[15px] font-bold">{h.customer.name}, {h.customer.age}</span>
                      <span className={`block text-[13px] leading-snug ${on ? "text-white/75" : "text-ink-2"}`}>{h.story}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {selectedId >= 0 && <p className="mt-3 text-[13px] text-ink-3">Showing customer #{selectedId} from the nightly pass.</p>}
          </section>

          <div className="order-1 flex flex-col items-center gap-3 lg:order-2">
            <MomentPhone key={selectedId} customer={customer} decision={decision} onConsent={onConsent} onAct={onAct} />
            <p className="text-center text-[12px] text-ink-3">Hackathon prototype, not an official KBC app. Synthetic data.</p>
          </div>

          <section aria-label="What is happening" className="order-3">
            <h2 className="text-[20px] font-bold">{live ? `Right now, ${first} is paying someone` : `Next morning, in ${first}'s app`}</h2>
            <p className="mt-2 text-[15px] text-ink-2">
              {live
                ? "The live guard compares this payment with what is normal for this person, while it happens, and steps in before the money leaves."
                : decision.chosen
                  ? "Last night the engine looked at every signal, found what matters most for this person, and chose one message. Everything else waited."
                  : "Last night the engine found nothing worth an interruption. Silence is a feature."}
            </p>
            <div className="mt-6"><AttentionRace decision={decision} name={first} /></div>
            <button onClick={() => setView("kbc")} className="mt-6 text-[14px] font-semibold text-accent underline underline-offset-4">See how this runs for 2.3 million customers</button>
          </section>
        </main>
      )}
    </div>
  );
}
