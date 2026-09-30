"use client";

import { useEffect, useState } from "react";
import { APP } from "@/config/app";
import { STATIC } from "@/lib/runtime";
import type { ExplainResponse, FinState, Insight, ProposedAction } from "@/lib/types";
import { eur } from "@/lib/util";
import { IconCheck, IconClose, IconShield, IconSparkle } from "./Icons";
import { TransactionList } from "./TransactionList";
import { Button, SeverityChip, Sheet } from "./ui";

export function humanKey(k: string) {
  const s = k.replace(/_/g, " ");
  return s[0].toUpperCase() + s.slice(1);
}

export function humanVal(k: string, v: string | number) {
  if (typeof v !== "number") return v;
  if (/percent|pct/.test(k)) return `${v}%`;
  if (/count|payments_|days|times/.test(k)) return String(v);
  return eur(v);
}

export function MetaLine({ meta }: { meta?: ExplainResponse["meta"] }) {
  if (!meta) return null;
  const txt =
    meta.guard === "passed"
      ? `Worded by ${meta.model} · every number checked against the engine`
      : meta.guard === "fallback_numbers"
        ? "AI invented a number, so we showed the engine's wording instead"
        : meta.guard === "fallback_error"
          ? "AI unavailable, showing the engine's wording"
          : "Template mode (no AI key) · numbers from the engine";
  return (
    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-3">
      <IconShield size={12} />
      {txt}
    </div>
  );
}

export function WhyPanel({ used, notUsed }: { used: string[]; notUsed: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-2xl bg-surface-2 p-3.5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left text-[13px] font-semibold text-brand">
        <span className="flex items-center gap-1.5">
          <IconShield size={15} /> Why am I seeing this?
        </span>
        <span className="text-ink-3">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="anim-fade mt-3 grid gap-3 text-[13px]">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Based on</div>
            {used.map((u) => (
              <div key={u} className="flex items-start gap-2 py-0.5">
                <IconCheck size={14} className="mt-0.5 shrink-0 text-good" strokeWidth={2.6} />
                {u}
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Never used</div>
            {notUsed.map((u) => (
              <div key={u} className="flex items-start gap-2 py-0.5 text-ink-2">
                <IconClose size={14} className="mt-0.5 shrink-0 text-ink-3" strokeWidth={2.6} />
                {u}
              </div>
            ))}
          </div>
          <div className="text-[12px] text-ink-3">{APP.assistantName} only suggests. Nothing happens to your money until you confirm.</div>
        </div>
      )}
    </div>
  );
}

export function InsightDetail({
  insight,
  state,
  onClose,
  onAction,
}: {
  insight: Insight;
  state: FinState;
  onClose: () => void;
  onAction: (a: ProposedAction) => void;
}) {
  const [ex, setEx] = useState<ExplainResponse | null>(null);
  const [showFacts, setShowFacts] = useState(false);

  useEffect(() => {
    let alive = true;
    setEx(null);
    if (STATIC) {
      const t = setTimeout(
        () =>
          alive &&
          setEx({
            headline: insight.title,
            explanation: insight.summary,
            meta: { llmUsed: false, provider: "none", model: "templates", guard: "no_llm", ms: 0 },
          }),
        350,
      );
      return () => {
        alive = false;
        clearTimeout(t);
      };
    }
    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insight, name: state.profile.name }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j: ExplainResponse) => alive && setEx(j))
      .catch(() =>
        alive &&
        setEx({
          headline: insight.title,
          explanation: insight.summary,
          meta: { llmUsed: false, provider: "none", model: "", guard: "fallback_error", ms: 0 },
        }),
      );
    return () => {
      alive = false;
    };
  }, [insight, state.profile.name]);

  const evidence = state.transactions.filter((t) => insight.evidence.includes(t.id)).slice(0, 6);

  return (
    <Sheet onClose={onClose} title="">
      <SeverityChip severity={insight.severity} />
      <h3 className="mt-2 text-[20px] font-bold leading-tight">{ex?.headline ?? insight.title}</h3>

      <div className="mt-3 min-h-[60px] text-[14.5px] leading-relaxed text-ink-2">
        {ex ? (
          <p className="anim-fade">{ex.explanation}</p>
        ) : (
          <div className="grid gap-2 pt-1">
            <div className="shimmer h-3.5 w-full" />
            <div className="shimmer h-3.5 w-11/12" />
            <div className="shimmer h-3.5 w-3/4" />
          </div>
        )}
      </div>
      {ex?.tip && (
        <div className="anim-fade mt-3 flex gap-2 rounded-xl bg-accent-soft p-3 text-[13px] text-brand">
          <IconSparkle size={16} className="mt-0.5 shrink-0" />
          {ex.tip}
        </div>
      )}
      <MetaLine meta={ex?.meta} />

      <div className="mt-5 grid gap-2">
        {insight.actions
          .filter((a) => a.type !== "DISMISS")
          .map((a) => (
            <Button key={a.label} size="lg" variant={a.primary ? (insight.severity === "critical" ? "danger" : "primary") : "soft"} onClick={() => onAction(a)} className="w-full">
              {a.label}
            </Button>
          ))}
        {insight.actions
          .filter((a) => a.type === "DISMISS")
          .map((a) => (
            <Button key={a.label} variant="ghost" onClick={() => onAction(a)} className="w-full">
              {a.label}
            </Button>
          ))}
      </div>

      <WhyPanel used={insight.dataUsed} notUsed={insight.dataNotUsed} />

      <div className="mt-3 rounded-2xl border border-line p-3.5">
        <button onClick={() => setShowFacts(!showFacts)} className="flex w-full justify-between text-[13px] font-semibold">
          <span>The numbers behind this</span>
          <span className="text-ink-3">{showFacts ? "Hide" : "Show"}</span>
        </button>
        {showFacts && (
          <div className="anim-fade mt-2 divide-y divide-line text-[13px]">
            {Object.entries(insight.facts).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-1.5">
                <span className="text-ink-2">{humanKey(k)}</span>
                <span className="tabular text-right font-medium">{humanVal(k, v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {evidence.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-ink-3">Related payments</div>
          <TransactionList txs={evidence} limit={6} />
        </div>
      )}
    </Sheet>
  );
}
