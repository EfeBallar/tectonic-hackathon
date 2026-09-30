"use client";

import { MOMENT_BY_ID } from "@/lib/moments";
import type { Decision, HoldReason } from "@/lib/orchestrator";

// The attention budget, made visible: every moment found for this customer competes for one slot.
// priority = urgency × confidence × relevance − interruption cost. Protection skips the queue.

const STATUS: Record<HoldReason, string> = {
  budget_full: "Waits: budget used up",
  lower_priority: "Lost the slot",
  not_worth_it: "Not worth interrupting",
  no_consent: "Offers switched off",
  muted: "Muted by customer",
  low_confidence: "Not sure enough",
};

export function AttentionRace({ decision: d, name }: { decision: Decision; name: string }) {
  const { used, size } = d.budget;
  const top = Math.max(0.3, ...d.ranked.filter((r) => !r.bypass).map((r) => r.priority));
  const winner = d.chosen?.momentId;
  const heldBy = new Map(d.held.map((h) => [h.momentId, h.reason]));
  const slotsLeft = Math.max(0, size - used);

  return (
    <div>
      <h2 className="text-[20px] font-bold leading-tight">Competing for {name}&apos;s attention</h2>
      <p className="mt-1 text-[14px] text-ink-2">One slot at a time. Priority = urgency × confidence × relevance to {name} − the cost of interrupting.</p>

      <div className="mt-4 flex items-center gap-2" aria-label={`${used} of ${size} interruptions used this week`}>
        {Array.from({ length: size }).map((_, i) => (
          <span key={i} className={`h-7 flex-1 rounded-md border-2 ${i < used ? "border-brand bg-brand" : i === used && winner && !MOMENT_BY_ID[winner].pillar.startsWith("protect") ? "border-accent bg-accent-soft" : "border-line bg-white"}`} />
        ))}
        <span className="ml-1 w-28 text-[12px] leading-tight text-ink-2">{slotsLeft} of {size} slots left this week</span>
      </div>

      {d.ranked.length === 0 ? (
        <p className="mt-5 rounded-lg bg-white p-4 text-[14px] text-ink-2">Nothing is competing. The best message today is no message.</p>
      ) : (
        <ol className="mt-5 space-y-3">
          {d.ranked.map((r) => {
            const m = MOMENT_BY_ID[r.momentId];
            const won = r.momentId === winner;
            const reason = heldBy.get(r.momentId);
            const w = r.bypass ? 100 : Math.max(2, (Math.max(0, r.priority) / top) * 100);
            return (
              <li key={r.momentId} className={`rounded-lg p-3 transition-colors ${won ? "bg-white shadow-[0_8px_24px_-14px_rgba(10,42,74,0.4)]" : "bg-white/50"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-[15px] ${won ? "font-bold" : "font-semibold text-ink-2"}`}>{m.label}</span>
                  <span className={`shrink-0 text-[12px] font-semibold ${won ? "text-accent" : r.bypass ? "text-protect" : "text-ink-3"}`}>
                    {won ? (r.bypass ? "Shown now, skips the queue" : "Wins the slot") : reason ? STATUS[reason] : ""}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-line/60">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ease-out ${r.bypass ? "bg-protect" : won ? "bg-accent" : "bg-ink-3/50"}`}
                    style={{ width: `${w}%` }}
                  />
                </div>
                <div className="tabular mt-1.5 text-[12px] text-ink-3">
                  {r.bypass
                    ? "Protection is never rationed"
                    : `${r.urgency} urgency × ${r.confidence.toFixed(2)} confidence × ${r.relevance.toFixed(2)} relevance − ${r.cost} = ${r.priority.toFixed(2)}`}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-4 text-[13px] text-ink-3">Tap “Not now” on the card: relevance for that kind of message halves for {name}, and you can watch it drop here.</p>
    </div>
  );
}
