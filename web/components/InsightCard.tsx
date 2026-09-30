"use client";

import type { Insight, ProposedAction } from "@/lib/types";
import { Button, SeverityChip } from "./ui";
import { IconChevron } from "./Icons";

const ICON: Record<Insight["kind"], string> = {
  suspicious_payment: "🚨",
  cash_crunch: "📉",
  spending_spike: "🍜",
  price_increase: "🔁",
  idle_cash: "💤",
};

const RING: Record<Insight["severity"], string> = {
  critical: "border-crit/40 ring-4 ring-crit-soft",
  warning: "border-warn/30",
  info: "border-line",
  positive: "border-good/30",
};

export function InsightCard({
  insight,
  onOpen,
  onAction,
}: {
  insight: Insight;
  onOpen: () => void;
  onAction: (a: ProposedAction) => void;
}) {
  const primary = insight.actions.find((a) => a.primary) ?? insight.actions[0];
  return (
    <div className={`anim-pop rounded-2xl border bg-surface p-4 ${RING[insight.severity]}`}>
      <button onClick={onOpen} className="block w-full text-left">
        <div className="mb-2 flex items-center justify-between">
          <SeverityChip severity={insight.severity} />
          <IconChevron size={16} className="text-ink-3" />
        </div>
        <div className="flex gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">{ICON[insight.kind]}</div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-snug">{insight.title}</div>
            <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-ink-2">{insight.summary}</p>
          </div>
        </div>
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {primary && (
          <Button size="sm" variant={insight.severity === "critical" ? "danger" : "primary"} onClick={() => onAction(primary)}>
            {primary.label}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onOpen}>
          Why?
        </Button>
      </div>
    </div>
  );
}
