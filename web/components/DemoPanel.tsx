"use client";

import { useState } from "react";
import { APP } from "@/config/app";
import { PERSONAS, SCENARIOS, type ScenarioId } from "@/lib/personas";
import type { Analysis, AskResponse } from "@/lib/types";
import { IconRefresh } from "./Icons";

// Presenter cockpit. Lives next to the phone on the laptop screen during the demo.
export function DemoPanel({
  personaId,
  onPersona,
  onScenario,
  onReset,
  analysis,
  lastAsk,
  status,
}: {
  personaId: string;
  onPersona: (id: string) => void;
  onScenario: (id: ScenarioId) => void;
  onReset: () => void;
  analysis: Analysis | null;
  lastAsk: AskResponse | null;
  status: { provider: string; model: string } | null;
}) {
  const [tab, setTab] = useState<"engine" | "ai">("engine");
  const engineView = analysis && {
    safeToSpend: analysis.safeToSpend,
    breakdown: analysis.safeToSpendBreakdown,
    lowest: analysis.lowest,
    nextPayday: analysis.nextPayday,
    dailyDiscretionary: analysis.dailyDiscretionary,
    upcoming: analysis.upcoming.map((u) => `${u.date} ${u.label} €${u.amount} (${u.source})`),
    recurring: analysis.recurring.map((r) => `${r.merchant}: €${r.prevAmount} → €${r.lastAmount}, next ${r.nextDate}`),
    insights: analysis.insights.map((i) => ({ id: i.id, severity: i.severity, facts: i.facts })),
  };
  const aiView = lastAsk && { intent: lastAsk.intent, facts: lastAsk.facts, actions: lastAsk.actions.map((a) => a.type), meta: lastAsk.meta };

  return (
    <aside className="w-full max-w-[400px] space-y-4 text-ink">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-widest text-accent">{APP.bankName} track · hackathon prototype</div>
        <h1 className="mt-1 text-[28px] font-bold leading-tight">
          {APP.productName} <span className="text-ink-3">with {APP.assistantName}</span>
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{APP.tagline}</p>
        <p className="mt-2 text-[14px] font-semibold text-brand">{APP.pitchLine}</p>
      </div>

      <div className="flex items-center gap-2 text-[12px]">
        <span className={`h-2 w-2 shrink-0 rounded-full ${status?.provider && !["none", "static"].includes(status.provider) ? "bg-good" : "bg-warn"}`} />
        {status == null
          ? "Checking AI…"
          : status.provider === "static"
            ? "Browser preview: engine + template wording. Run the repo with a Gemini key for AI wording."
            : status.provider === "none"
            ? "Template mode: add GEMINI_API_KEY to .env.local for AI wording"
            : `AI on: ${status.provider} · ${status.model}`}
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Customer</div>
        <div className="grid gap-2">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              onClick={() => onPersona(p.id)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${p.id === personaId ? "border-accent bg-accent-soft" : "border-line hover:border-accent/40"}`}
            >
              <span className="text-xl">{p.emoji}</span>
              <span>
                <span className="block text-[14px] font-semibold">
                  {p.name}, {p.age}
                </span>
                <span className="block text-[12px] text-ink-2">{p.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">Live events</span>
          <button onClick={onReset} className="flex items-center gap-1 text-[12px] font-semibold text-accent">
            <IconRefresh size={12} /> Reset
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => onScenario(s.id)} className="rounded-xl border border-line px-3 py-2 text-left transition hover:border-accent/50 hover:bg-accent-soft/40">
              <span className="block text-[13.5px] font-semibold">
                {s.emoji} {s.label}
              </span>
              <span className="block text-[11.5px] text-ink-3">{s.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-center gap-1 text-[12px]">
          <span className="mr-auto font-semibold uppercase tracking-wide text-ink-3">Under the hood</span>
          {(["engine", "ai"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-2.5 py-0.5 font-semibold ${tab === t ? "bg-ink text-white" : "text-ink-2"}`}>
              {t === "engine" ? "Engine" : "Last AI call"}
            </button>
          ))}
        </div>
        <pre className="max-h-[260px] overflow-auto rounded-xl bg-[#0d1726] p-3 font-mono text-[10.5px] leading-relaxed text-[#cfe3ff] no-scrollbar">
          {tab === "engine"
            ? JSON.stringify(engineView, null, 2)
            : aiView
              ? JSON.stringify(aiView, null, 2)
              : "// Ask Kate something to see the intent → engine facts → guarded answer pipeline"}
        </pre>
      </section>

      <div className="text-[11.5px] text-ink-3">{APP.footer}</div>
    </aside>
  );
}
