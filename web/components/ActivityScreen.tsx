"use client";

import { APP } from "@/config/app";
import type { FinState, ProposedAction } from "@/lib/types";
import { fmtDate } from "@/lib/util";
import { IconCalendar, IconCheck, IconRefresh, IconShield, IconSnow } from "./Icons";
import { Button, Card, SectionTitle } from "./ui";

export function ActivityScreen({
  state,
  onAction,
  canUndo,
  onUndo,
}: {
  state: FinState;
  onAction: (a: ProposedAction) => void;
  canUndo: boolean;
  onUndo: () => void;
}) {
  return (
    <div className="px-4 pb-8 pt-4">
      <h1 className="text-[22px] font-bold">Activity</h1>
      <p className="mt-1 text-[13px] text-ink-2">Everything {APP.assistantName} did, and the moment you approved it.</p>

      {state.cardFrozen && (
        <Card className="mt-4 border-crit/30">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-crit-soft text-crit">
              <IconSnow size={18} />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold">Debit card frozen</div>
              <div className="text-[12px] text-ink-3">Dispute opened for the reported payment</div>
            </div>
            <Button size="sm" variant="soft" onClick={() => onAction({ type: "UNFREEZE_CARD", label: "Unfreeze", params: {} })}>
              Unfreeze
            </Button>
          </div>
        </Card>
      )}

      {state.reminders.length > 0 && (
        <>
          <SectionTitle>Reminders</SectionTitle>
          <div className="grid gap-2">
            {state.reminders.map((r) => (
              <Card key={r.id} className="flex items-center gap-3 py-3">
                <IconCalendar size={18} className="text-accent" />
                <div className="flex-1 text-[13.5px]">
                  <div className="font-medium">{r.label}</div>
                  <div className="text-[12px] text-ink-3">{fmtDate(r.date, "long")}</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle
        right={
          canUndo ? (
            <button onClick={onUndo} className="flex items-center gap-1 text-[12.5px] font-semibold text-accent">
              <IconRefresh size={13} /> Undo last
            </button>
          ) : null
        }
      >
        Approved by you
      </SectionTitle>
      {state.activity.length === 0 ? (
        <Card className="text-center text-[13.5px] text-ink-3">
          Nothing yet. When {APP.assistantName} suggests something and you confirm, it shows up here.
        </Card>
      ) : (
        <div className="relative grid gap-2 pl-5">
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-line" />
          {state.activity.map((e) => (
            <div key={e.id} className="anim-pop relative">
              <div className="absolute -left-5 top-3.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-good text-white ring-4 ring-page">
                <IconCheck size={9} strokeWidth={3.5} />
              </div>
              <Card className="py-3">
                <div className="text-[14px] font-semibold">{e.title}</div>
                {e.detail && <div className="text-[12.5px] text-ink-2">{e.detail}</div>}
                <div className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-3">
                  <IconShield size={11} /> Approved{" "}
                  {new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {e.origin}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
