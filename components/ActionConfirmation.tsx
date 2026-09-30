"use client";

import { useMemo } from "react";
import { APP } from "@/config/app";
import { applyAction, describeAction } from "@/lib/actions";
import { analyze } from "@/lib/engine";
import type { FinState, ProposedAction } from "@/lib/types";
import { eur0 } from "@/lib/util";
import { IconLock } from "./Icons";
import { Button } from "./ui";

// The consent step. The assistant proposes, the customer disposes.
// Shows a deterministic before/after preview so the customer knows exactly what changes.
export function ActionConfirmation({
  action,
  state,
  onCancel,
  onConfirm,
}: {
  action: ProposedAction;
  state: FinState;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { title, lines } = describeAction(action, state);
  const impact = useMemo(() => {
    if (!["MOVE_TO_SAVINGS", "TRANSFER_FROM_SAVINGS"].includes(action.type)) return null;
    const before = analyze(state);
    const after = analyze(applyAction(state, action, "preview"));
    return {
      rows: [
        { label: "Checking", a: state.checking, b: applyAction(state, action, "preview").checking },
        { label: "Safe to spend", a: before.safeToSpend, b: after.safeToSpend },
        { label: "Lowest point before payday", a: before.lowest.balance, b: after.lowest.balance },
      ],
      warn: after.lowest.balance < state.profile.bufferTarget && after.lowest.balance < before.lowest.balance,
    };
  }, [action, state]);

  const danger = action.type === "FREEZE_CARD";

  return (
    <div className="absolute inset-0 z-40 flex items-end">
      <div className="anim-fade absolute inset-0 bg-ink/50" onClick={onCancel} />
      <div className="anim-sheet relative w-full rounded-t-3xl bg-surface p-5 pb-7 shadow-2xl">
        <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">
          <IconLock size={13} /> {APP.assistantName} suggests · you decide
        </div>
        <h3 className="text-[20px] font-bold leading-tight">{title}</h3>
        <div className="mt-2 grid gap-1 text-[13.5px] text-ink-2">
          {lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>

        {impact && (
          <div className="mt-4 rounded-2xl bg-surface-2 p-3">
            <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-x-4 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              <span>Impact</span>
              <span className="text-right">Now</span>
              <span className="text-right">After</span>
            </div>
            {impact.rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-1 text-[13.5px]">
                <span className="text-ink-2">{r.label}</span>
                <span className="tabular text-right">{eur0(r.a)}</span>
                <span className={`tabular text-right font-semibold ${r.b > r.a ? "text-good" : r.b < r.a ? "text-ink" : ""}`}>{eur0(r.b)}</span>
              </div>
            ))}
            {impact.warn && (
              <div className="mt-2 rounded-lg bg-warn-soft px-2.5 py-1.5 text-[12px] text-warn">
                This takes you under your {eur0(state.profile.bufferTarget)} buffer before payday.
              </div>
            )}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="soft" size="lg" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} size="lg" onClick={onConfirm}>
            Confirm
          </Button>
        </div>
        <div className="mt-3 text-center text-[11px] text-ink-3">Nothing happens until you confirm. You can undo from Activity.</div>
      </div>
    </div>
  );
}
