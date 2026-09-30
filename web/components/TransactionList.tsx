"use client";

import type { Transaction } from "@/lib/types";
import { CATEGORY_EMOJI, eur, fmtDate } from "@/lib/util";

export function TransactionList({
  txs,
  highlight = [],
  flagged = [],
  limit,
}: {
  txs: Transaction[];
  highlight?: string[];
  flagged?: string[];
  limit?: number;
}) {
  const list = limit ? txs.slice(0, limit) : txs;
  if (!list.length) return <div className="py-6 text-center text-sm text-ink-3">No payments</div>;
  let lastDate = "";
  return (
    <div className="divide-y divide-line">
      {list.map((t) => {
        const showDate = t.date !== lastDate;
        lastDate = t.date;
        const isFlag = flagged.includes(t.id);
        return (
          <div key={t.id}>
            {showDate && !limit && <div className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{fmtDate(t.date, "long")}</div>}
            <div className={`flex items-center gap-3 py-2.5 ${highlight.includes(t.id) ? "-mx-2 rounded-lg bg-accent-soft/60 px-2" : ""}`}>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-base">{CATEGORY_EMOJI[t.category]}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">
                  {t.merchant}
                  {isFlag && <span className="ml-1.5 rounded bg-crit-soft px-1.5 py-0.5 text-[10px] font-semibold text-crit">Reported</span>}
                </div>
                <div className="text-[12px] text-ink-3">
                  {limit ? `${fmtDate(t.date)} · ` : ""}
                  {t.time}
                  {t.country && t.country !== "BE" ? ` · ${t.country}` : ""}
                </div>
              </div>
              <div className={`tabular text-[14px] font-semibold ${t.amount > 0 ? "text-good" : "text-ink"}`}>{eur(t.amount, { sign: true })}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
