"use client";

import { useState } from "react";
import { assessPayment, MOMENT_BY_ID, MOMENTS, type SignalGroup } from "@/lib/moments";
import type { Decision } from "@/lib/orchestrator";
import type { Consent } from "@/lib/pass";
import type { Customer } from "@/lib/population";

const eur = (n: number) => `€${Math.round(n).toLocaleString("nl-BE")}`;
const GROUP: Record<SignalGroup, { dot: string; label: string }> = {
  money: { dot: "bg-accent", label: "Money" },
  behavior: { dot: "bg-amber", label: "Behavior" },
  context: { dot: "bg-protect", label: "Context" },
  life: { dot: "bg-calm", label: "Life" },
};
const Dot = ({ g }: { g: SignalGroup }) => <span className={`mr-1.5 inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full ${GROUP[g].dot}`} aria-label={GROUP[g].label} />;
const CHANNEL_TXT = { app: "In-app card", push: "Push notification", kate: "Kate chat", email: "Email", advisor: "Advisor call" } as const;

type Tab = "home" | "privacy";

export function MomentPhone({
  customer,
  decision,
  onConsent,
  onFeedback,
}: {
  customer: Customer;
  decision: Decision;
  onConsent: (c: Consent) => void;
  onFeedback: (momentId: string, acted: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("home");
  const [why, setWhy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const c = customer;
  const chosen = decision.chosen;
  const m = chosen ? MOMENT_BY_ID[chosen.momentId] : null;
  const act = m ? m.action(c) : null;
  const guard = assessPayment(c);
  const scamLive = chosen?.momentId === "scam_in_progress" && guard && (guard.tier === "pause" || guard.tier === "block");
  const first = c.name.split(" ")[0];

  return (
    <div className="phone relative flex shrink-0 flex-col overflow-hidden bg-surface">
      {/* status bar */}
      <div className="flex items-center justify-between bg-brand px-6 pb-1 pt-2 text-[12px] font-semibold text-white">
        <span>{c.session ? `${String(c.session.hour).padStart(2, "0")}:12` : "09:41"}</span>
        <span className="flex items-center gap-1.5">
          {c.session?.activeCall && <span className="rounded bg-calm px-1.5 text-[10px]">On a call</span>}
          {c.session?.remoteAccessApp && <span className="rounded bg-amber px-1.5 text-[10px] text-night">{c.session.remoteAccessApp} running</span>}
          <span>5G ▮▮▮</span>
        </span>
      </div>

      <div className="relative flex-1 overflow-y-auto no-scrollbar">
        {tab === "home" ? (
          <div className="pb-6">
            <div className="bg-brand px-5 pb-14 pt-3 text-white">
              <div className="text-[13px] opacity-70">KBC Mobile</div>
              <div className="text-xl font-bold">Hi {first}</div>
              <div className="mt-3 text-[12px] opacity-80">Current account</div>
              <div className="tabular text-3xl font-bold">{eur(c.checking)}</div>
              <div className="text-[12px] opacity-80">Savings {eur(c.savingsBalance)}, salary in {c.daysToPayday} days</div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] opacity-90">
                <span>KBC interrupted you</span>
                {Array.from({ length: decision.budget.size }).map((_, i) => (
                  <span key={i} className={`h-2 w-2 rounded-full ${i < decision.budget.used ? "bg-white" : "bg-white/30"}`} />
                ))}
                <span>{Math.min(decision.budget.used, decision.budget.size)} of {decision.budget.size} times this week</span>
              </div>
            </div>

            <div className="-mt-10 space-y-3 px-4">
              {/* the one moment, or calm */}
              {m && act && !scamLive ? (
                <div className={`anim-pop rounded-xl border-l-4 bg-surface p-4 shadow-[0_8px_24px_-12px_rgba(10,42,74,0.35)] ${m.pillar === "protect" ? "border-protect" : m.pillar === "support" ? "border-amber" : "border-calm"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-ink-2">
                      {m.pillar === "protect" ? "Protecting you" : m.pillar === "support" ? "Heads up" : "For you"}
                    </span>
                    <span className="text-[11px] text-ink-3">via {CHANNEL_TXT[chosen!.channel]}</span>
                  </div>
                  <div className="mt-2 text-[16px] font-semibold leading-snug">{act.title}</div>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{act.message}</p>
                  {chosen!.channel === "advisor" && (
                    <div className="mt-2 rounded-xl bg-good-soft p-2 text-[12px] text-good">An advisor will call you. They already have a short brief, so you won't have to repeat yourself.</div>
                  )}
                  {m.id === "idle_cash" && <GoalFill customer={c} />}
                  {done === m.id ? (
                    <div className="mt-3 rounded-xl bg-good-soft p-2 text-center text-[13px] font-semibold text-good">Done. You can undo this in Activity.</div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => { setDone(m.id); onFeedback(m.id, true); }} className="h-10 flex-1 rounded-full bg-accent text-sm font-semibold text-white">{act.cta}</button>
                      <button onClick={() => onFeedback(m.id, false)} className="h-10 rounded-full px-3 text-sm text-ink-2 hover:bg-surface-2">Not now</button>
                    </div>
                  )}
                  <button onClick={() => setWhy(true)} className="mt-2 w-full text-center text-[12px] font-semibold text-accent">Why am I seeing this?</button>
                </div>
              ) : !scamLive ? (
                <div className="rounded-xl border-l-4 border-calm bg-surface p-4 shadow-[0_8px_24px_-12px_rgba(10,42,74,0.35)]">
                  <div className="text-[15px] font-semibold">All good today</div>
                  <p className="mt-1 text-[13px] text-ink-2">Nothing needs your attention, so we won't bother you. We'll speak up when something matters.</p>
                  {decision.held.length > 0 && (
                    <button onClick={() => setWhy(true)} className="mt-2 text-[12px] font-semibold text-accent">Why is KBC quiet?</button>
                  )}
                </div>
              ) : null}

              {/* recent evidence trail */}
              {c.recent.length > 0 && (
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <div className="mb-1 text-[14px] font-semibold">Recent</div>
                  {c.recent.slice(0, 5).map((t, i) => (
                    <div key={i} className="flex justify-between border-t border-line py-1.5 text-[13px] first:border-0">
                      <span>{t.label}<span className="ml-1 text-[11px] text-ink-3">{t.daysAgo === 0 ? "today" : `${t.daysAgo}d ago`}</span></span>
                      <span className={`tabular ${t.amount > 0 ? "text-good" : ""}`}>{t.amount > 0 ? "+" : ""}{eur(t.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <Privacy customer={c} decision={decision} onConsent={onConsent} />
        )}

        {/* live scam guard: a transfer is in progress */}
        {scamLive && c.session?.attempt && guard && (
          <ScamGuard customer={c} score={guard.score} factors={guard.factors} onWhy={() => setWhy(true)} />
        )}

        {why && <WhySheet customer={c} decision={decision} onClose={() => setWhy(false)} />}
      </div>

      {/* tab bar */}
      <div className="flex border-t border-line bg-surface text-[12px]">
        {(["home", "privacy"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 font-semibold ${tab === t ? "text-accent" : "text-ink-3"}`}>
            {t === "home" ? "Home" : "What KBC knows"}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScamGuard({ customer: c, score, factors, onWhy }: { customer: Customer; score: number; factors: { text: string; group: SignalGroup }[]; onWhy: () => void }) {
  const [state, setState] = useState<"paused" | "calling" | "cancelled">("paused");
  const a = c.session!.attempt!;
  const blocked = a.payee.flag === "blacklisted";
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface anim-fade">
      <div className="bg-crit px-5 pb-5 pt-4 text-white">
        <div className="text-[13px] font-semibold opacity-90">Payment paused, risk {Math.round(score * 100)}%</div>
        <div className="mt-1 text-xl font-bold leading-snug">
          {blocked ? "We stopped this payment" : "Stop. Is someone on the phone with you right now?"}
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="rounded-2xl border border-line p-3 text-[13px]">
          <div className="text-ink-3">You were about to send</div>
          <div className="tabular text-2xl font-bold">{eur(a.amount)}</div>
          <div className="text-ink-2">to “{a.payee.name}”</div>
          <div className="tabular text-[12px] text-ink-3">{a.payee.iban}</div>
          <div className="text-[12px] text-ink-3">message: “{a.note}”</div>
        </div>
        {state === "paused" && (
          <>
            <p className="text-[14px] leading-relaxed">
              {blocked
                ? "This account is known to be used by scammers. No money left your account."
                : "KBC will never call you to move money to a “safe account” or ask you to install AnyDesk or TeamViewer. Scammers sound exactly like bank staff. Your money is still here."}
            </p>
            <div className="rounded-2xl bg-crit-soft p-3 text-[13px]">
              <div className="mb-1 font-semibold text-crit">What we noticed</div>
              <ul className="space-y-0.5 text-ink-2">
                {factors.slice(0, 6).map((f, i) => <li key={i} className="flex items-baseline"><Dot g={f.group} />{f.text}</li>)}
              </ul>
            </div>
            <button onClick={() => setState("calling")} className="h-12 w-full rounded-full bg-accent text-[15px] font-semibold text-white">Hang up and talk to a real KBC employee</button>
            <button onClick={() => setState("cancelled")} className="h-11 w-full rounded-full border border-line text-sm font-semibold">Cancel this payment</button>
            {!blocked && <button onClick={() => setState("cancelled")} className="w-full text-center text-[12px] text-ink-3">It's really me: send it after a 24h cooling-off period</button>}
            <button onClick={onWhy} className="w-full text-center text-[12px] font-semibold text-accent">Why did KBC pause this?</button>
          </>
        )}
        {state === "calling" && (
          <div className="rounded-2xl bg-good-soft p-4 text-[14px] text-good">
            <div className="font-semibold">Connecting you to the KBC fraud team…</div>
            <div className="mt-1 text-[13px]">Verified in-app call, not a phone number anyone can fake. The employee already sees this paused payment and why it was flagged.</div>
          </div>
        )}
        {state === "cancelled" && (
          <div className="rounded-2xl bg-good-soft p-4 text-[14px] font-semibold text-good">Payment cancelled. {eur(a.amount)} is safe in your account.</div>
        )}
      </div>
    </div>
  );
}

function GoalFill({ customer: c }: { customer: Customer }) {
  // PM idea: make the savings goal tangible, e.g. a house that fills up
  const older = c.age >= 45;
  const goal = older ? 30000 : 10000;
  const pctDone = Math.min(1, c.savingsBalance / (goal * 3));
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface-2 p-2">
      <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-line text-center text-3xl leading-[48px]">
        <div className="absolute inset-x-0 bottom-0 bg-good/40" style={{ height: `${pctDone * 100}%` }} />
        <span className="relative">{older ? "🏡" : "🚗"}</span>
      </div>
      <div className="text-[12px] text-ink-2">
        <b className="text-ink">{Math.round(pctDone * 100)}%</b> towards your {older ? "renovation" : "first car"} goal if you start today
      </div>
    </div>
  );
}

function WhySheet({ customer: c, decision: d, onClose }: { customer: Customer; decision: Decision; onClose: () => void }) {
  const chosen = d.chosen;
  const det = chosen ? d.detections.find((x) => x.momentId === chosen.momentId) : null;
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="anim-fade absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="anim-sheet relative max-h-[85%] overflow-y-auto rounded-t-3xl bg-surface p-5 no-scrollbar">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[15px] font-semibold">Why this, why now</div>
          <button onClick={onClose} className="text-ink-3">✕</button>
        </div>
        {chosen && det ? (
          <>
            <div className="text-[13px] text-ink-2">
              <b className="text-ink">{MOMENT_BY_ID[chosen.momentId].label}</b>, {Math.round(chosen.confidence * 100)}% confident
            </div>
            <Section title="Signals we used">
              {det.evidence.map((e, i) => <li key={i} className="flex items-baseline"><Dot g={e.group} /><span><span className="text-ink-3">{GROUP[e.group].label}:</span> {e.text}</span></li>)}
            </Section>
            <Section title="Checks it passed">
              {d.checks.map((x, i) => <li key={i} className="text-ink-2">{x}</li>)}
            </Section>
            <Section title="Competing for your attention this week">
              {d.ranked.map((r) => (
                <li key={r.momentId} className="flex justify-between gap-2">
                  <span className={r.momentId === chosen.momentId ? "font-semibold" : "text-ink-2"}>{MOMENT_BY_ID[r.momentId].label}</span>
                  <span className="tabular text-ink-3">{r.bypass ? "always" : r.priority.toFixed(2)}</span>
                </li>
              ))}
            </Section>
            <Section title="How it reached you">
              <li>{CHANNEL_TXT[chosen.channel]}: {chosen.reason}</li>
            </Section>
          </>
        ) : (
          <p className="text-[13px] text-ink-2">No message today. That's on purpose.</p>
        )}
        {d.held.length > 0 && (
          <Section title="What we held back, and why">
            {d.held.map((h, i) => <li key={i}>⏸ <b>{MOMENT_BY_ID[h.momentId].label}</b>: {h.text}</li>)}
          </Section>
        )}
        <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[12px] text-ink-3">
          Code decided this, not an AI guess. Nothing happens to your money without your tap.
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-[14px] font-semibold">{title}</div>
      <ul className="space-y-1 text-[13px]">{children}</ul>
    </div>
  );
}

function Privacy({ customer: c, decision: d, onConsent }: { customer: Customer; decision: Decision; onConsent: (x: Consent) => void }) {
  const groups = new Map<SignalGroup, string[]>();
  for (const det of d.detections) for (const e of det.evidence) groups.set(e.group, [...(groups.get(e.group) ?? []), e.text]);
  const toggle = (k: keyof Consent) => onConsent({ ...c.consent, [k]: !c.consent[k] });
  return (
    <div className="p-4 pb-8">
      <div className="text-xl font-bold">What KBC knows about me</div>
      <p className="mt-1 text-[13px] text-ink-2">You decide how we use it. Changes apply immediately.</p>

      <div className="mt-4 space-y-2">
        <Toggle label="Personalized offers" sub="Insurance, savings and investment suggestions based on my life moments" on={c.consent.personalizedOffers} onClick={() => toggle("personalizedOffers")} />
        <Toggle label="Push notifications" sub="Otherwise we only show things inside the app" on={c.consent.push} onClick={() => toggle("push")} />
        <Toggle label="Advisor may contact me" sub="For big moments like moving or a new family member" on={c.consent.advisor} onClick={() => toggle("advisor")} />
        <div className="rounded-2xl bg-crit-soft p-3 text-[12px] text-crit">
          Scam and fraud protection always stays on. It protects your money, it never sells you anything.
        </div>
      </div>

      <div className="mt-6 text-[15px] font-semibold">Kinds of messages</div>
      <p className="text-[12px] text-ink-3">Tap to switch one off.</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {MOMENTS.filter((x) => x.pillar !== "protect").map((x) => {
          const muted = c.consent.muted?.includes(x.id);
          return (
            <button
              key={x.id}
              onClick={() => onConsent({ ...c.consent, muted: muted ? (c.consent.muted ?? []).filter((y) => y !== x.id) : [...(c.consent.muted ?? []), x.id] })}
              className={`rounded-full border px-2.5 py-1 text-[12px] ${muted ? "border-line text-ink-3 line-through" : "border-accent/40 bg-accent-soft text-brand"}`}
            >
              {x.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-[15px] font-semibold">Signals behind today&apos;s picture</div>
      {groups.size === 0 && <p className="mt-1 text-[13px] text-ink-2">Nothing stood out today.</p>}
      {[...groups.entries()].map(([g, items]) => (
        <div key={g} className="mt-2 rounded-2xl border border-line p-3 text-[13px]">
          <div className="flex items-baseline font-semibold"><Dot g={g} />{GROUP[g].label}</div>
          <ul className="mt-1 space-y-0.5 text-ink-2">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      ))}
      <div className="mt-4 rounded-2xl bg-surface-2 p-3 text-[12px] text-ink-2">
        <b>Never used:</b> health or pregnancy from pharmacy payments, religion or politics from donations, relationships from shared payments.
      </div>
    </div>
  );
}

function Toggle({ label, sub, on, onClick }: { label: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left">
      <div className="flex-1">
        <div className="text-[14px] font-semibold">{label}</div>
        <div className="text-[12px] text-ink-3">{sub}</div>
      </div>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-good" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
