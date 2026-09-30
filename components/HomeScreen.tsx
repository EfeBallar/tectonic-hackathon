"use client";

import { APP } from "@/config/app";
import type { Analysis, Category, FinState, Insight, ProposedAction } from "@/lib/types";
import { CATEGORY_EMOJI, CATEGORY_LABEL, diffDays, eur, eur0, fmtDate, relDays } from "@/lib/util";
import { IconBell, IconChevron, IconInfo, IconSnow, IconSparkle } from "./Icons";
import { InsightCard } from "./InsightCard";
import { ProjectionChart } from "./ProjectionChart";
import { TransactionList } from "./TransactionList";
import { Card, SectionTitle } from "./ui";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function HomeScreen({
  state,
  analysis,
  onOpenInsight,
  onAction,
  onOpenSafe,
  onOpenTx,
  onAsk,
}: {
  state: FinState;
  analysis: Analysis;
  onOpenInsight: (i: Insight) => void;
  onAction: (a: ProposedAction, insight?: Insight) => void;
  onOpenSafe: () => void;
  onOpenTx: (filter?: { category?: Category }) => void;
  onAsk: () => void;
}) {
  const a = analysis;
  const below = a.lowest.balance < state.profile.bufferTarget;
  return (
    <div className="pb-8">
      {/* header */}
      <div className="bg-gradient-to-b from-brand to-brand-2 px-5 pb-16 pt-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] text-white/70">{greeting()},</div>
            <div className="text-[22px] font-bold leading-tight">{state.profile.name}</div>
          </div>
          <div className="relative rounded-full bg-white/10 p-2.5">
            <IconBell size={19} />
            {a.insights.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-crit px-1 text-[10px] font-bold">
                {a.insights.length}
              </span>
            )}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[12px] text-white/65">Checking</div>
            <div className="tabular text-[20px] font-semibold">{eur(state.checking)}</div>
          </div>
          <div>
            <div className="text-[12px] text-white/65">Savings</div>
            <div className="tabular text-[20px] font-semibold">{eur(state.savings)}</div>
          </div>
        </div>
        {state.cardFrozen && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium">
            <IconSnow size={13} /> Debit card frozen
          </div>
        )}
      </div>

      <div className="-mt-12 px-4">
        {/* hero: safe to spend */}
        <Card className="shadow-[0_8px_30px_-12px_rgba(10,40,80,0.25)]">
          <button onClick={onOpenSafe} className="flex w-full items-start justify-between text-left">
            <div>
              <div className="flex items-center gap-1 text-[13px] font-medium text-ink-2">
                Safe to spend until payday <IconInfo size={13} className="text-ink-3" />
              </div>
              <div className={`tabular mt-0.5 text-[40px] font-bold leading-none tracking-tight ${a.safeToSpend === 0 ? "text-warn" : "text-ink"}`}>
                {eur0(a.safeToSpend)}
              </div>
              <div className="mt-1.5 text-[12.5px] text-ink-3">
                Payday {relDays(a.daysToPayday)} · keeps your {eur0(state.profile.bufferTarget)} buffer
              </div>
            </div>
          </button>
          <div className="mt-3">
            <ProjectionChart
              points={a.projection.slice(0, Math.max(a.daysToPayday, 2))}
              buffer={state.profile.bufferTarget}
              endLabel={`Payday ${fmtDate(a.nextPayday)}`}
              lowestDay={a.lowest.day}
            />
          </div>
          {below && (
            <div className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
              You're set to dip under your buffer on {fmtDate(a.lowest.date)}.
            </div>
          )}
        </Card>

        {/* insights */}
        <SectionTitle
          right={
            <span className="flex items-center gap-1 text-[12px] text-ink-3">
              <IconSparkle size={12} /> {a.insights.length} new
            </span>
          }
        >
          {APP.assistantName} noticed
        </SectionTitle>
        <div className="grid gap-3">
          {a.insights.length === 0 && (
            <Card className="text-center text-[13.5px] text-ink-2">All clear. Nothing needs your attention right now. ✨</Card>
          )}
          {a.insights.map((i) => (
            <InsightCard key={i.id} insight={i} onOpen={() => onOpenInsight(i)} onAction={(act) => onAction(act, i)} />
          ))}
        </div>

        <button
          onClick={onAsk}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-accent/40 bg-accent-soft/50 px-4 py-3 text-left text-[13.5px] text-brand"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-white">
            <IconSparkle size={16} />
          </span>
          <span className="flex-1">
            Ask {APP.assistantName}: <span className="text-ink-2">“Can I afford a trip this weekend?”</span>
          </span>
          <IconChevron size={16} />
        </button>

        {/* upcoming */}
        <SectionTitle>Coming up before payday</SectionTitle>
        <Card className="py-1">
          {a.upcoming.length === 0 && <div className="py-3 text-[13px] text-ink-3">Nothing scheduled.</div>}
          <div className="divide-y divide-line">
            {a.upcoming.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-2.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2">{CATEGORY_EMOJI[u.category]}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{u.label}</div>
                  <div className="text-[12px] text-ink-3">
                    {fmtDate(u.date)} · {relDays(diffDays(u.date, state.today))} · {u.source === "predicted" ? "predicted from history" : "scheduled"}
                  </div>
                </div>
                <div className="tabular text-[14px] font-semibold">−{eur(u.amount)}</div>
              </div>
            ))}
            <div className="flex items-center gap-3 py-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-good-soft">💶</div>
              <div className="flex-1">
                <div className="text-[14px] font-medium">{state.profile.incomeLabel}</div>
                <div className="text-[12px] text-ink-3">
                  {fmtDate(a.nextPayday)} · {relDays(a.daysToPayday)}
                </div>
              </div>
              <div className="tabular text-[14px] font-semibold text-good">+{eur(a.expectedIncome)}</div>
            </div>
          </div>
        </Card>

        {/* budgets & goals */}
        {(state.budgets.length > 0 || state.goals.length > 0) && (
          <>
            <SectionTitle>Your plans</SectionTitle>
            <div className="grid gap-2">
              {state.budgets.map((b) => {
                const spent = state.transactions
                  .filter((t) => t.category === b.category && t.amount < 0 && t.date >= b.createdAt)
                  .reduce((x, t) => x - t.amount, 0);
                const pct = Math.min(100, (spent / b.limit) * 100);
                return (
                  <Card key={b.id} className="anim-pop">
                    <div className="flex justify-between text-[13.5px]">
                      <span className="font-medium">
                        {CATEGORY_EMOJI[b.category]} {CATEGORY_LABEL[b.category]}
                      </span>
                      <span className="tabular text-ink-2">
                        {eur0(spent)} of {eur0(b.limit)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-accent-soft">
                      <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <div className="mt-1 text-[11.5px] text-ink-3">Monthly cap · nudge at 80%</div>
                  </Card>
                );
              })}
              {state.goals.map((g) => (
                <Card key={g.id} className="anim-pop">
                  <div className="flex justify-between text-[13.5px]">
                    <span className="font-medium">🎯 {g.label}</span>
                    <span className="tabular text-ink-2">{eur0(g.amount)}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    By {fmtDate(g.date)} · {eur0(g.perWeek)}/week
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* recent */}
        <SectionTitle
          right={
            <button onClick={() => onOpenTx()} className="text-[12.5px] font-semibold text-accent">
              See all
            </button>
          }
        >
          Recent payments
        </SectionTitle>
        <Card className="py-1">
          <TransactionList txs={state.transactions} limit={5} flagged={state.reportedTx} />
        </Card>
      </div>
    </div>
  );
}
