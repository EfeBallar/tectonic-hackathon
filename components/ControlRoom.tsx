"use client";

import { useRef, useState } from "react";
import { HEROES } from "@/lib/heroes";
import { MOMENTS, NOT_DETECTED, type MomentId, type Pillar } from "@/lib/moments";
import type { HoldReason } from "@/lib/orchestrator";
import { emptyStats, runChunk, type Patch, type PassStats, type SampleKey } from "@/lib/pass";
import type { Channel } from "@/lib/population";

const SIZES = [
  { n: 100_000, label: "100,000 customers" },
  { n: 1_000_000, label: "1 million customers" },
  { n: 2_300_000, label: "All 2.3 million customers" },
];
const CHUNK = 25_000;

const PILLARS: { id: Pillar; label: string; dot: string }[] = [
  { id: "protect", label: "Protect", dot: "bg-protect" },
  { id: "support", label: "Support", dot: "bg-amber" },
  { id: "guide", label: "Guide", dot: "bg-calm" },
];
const HOLDS: { id: HoldReason; label: string }[] = [
  { id: "budget_full", label: "Attention budget already used this week" },
  { id: "lower_priority", label: "Lost the slot to something more urgent" },
  { id: "not_worth_it", label: "Not worth an interruption" },
  { id: "no_consent", label: "Customer switched off offers" },
  { id: "muted", label: "Customer muted this kind of message" },
  { id: "low_confidence", label: "Signals too weak to be sure" },
];
const CHANNELS: { id: Channel; label: string; cls: string }[] = [
  { id: "app", label: "App card", cls: "bg-signal" },
  { id: "push", label: "Push", cls: "bg-white" },
  { id: "kate", label: "Kate", cls: "bg-[#7FD3F7]" },
  { id: "email", label: "Email", cls: "bg-white/40" },
  { id: "advisor", label: "Advisor", cls: "bg-calm" },
];

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const eurShort = (n: number) => (n >= 1e6 ? `€${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `€${Math.round(n / 1e3)}k` : `€${Math.round(n)}`);

export function ControlRoom({
  stats,
  setStats,
  overrides,
  budget,
  setBudget,
  selectedId,
  onSelect,
}: {
  stats: PassStats | null;
  setStats: (s: PassStats) => void;
  overrides: Map<number, Patch>;
  budget: number;
  setBudget: (n: number) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [size, setSize] = useState(SIZES[2].n);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState<SampleKey>("scam_in_progress");
  const stop = useRef(false);

  function run(b = budget) {
    const s = emptyStats();
    const total = size;
    let i = 0;
    stop.current = false;
    setRunning(true);
    const step = () => {
      const end = Math.min(total, i + CHUNK);
      runChunk(s, i, end, overrides, b);
      i = end;
      setProgress(i / total);
      setStats({ ...s });
      if (i < total && !stop.current) setTimeout(step, 0);
      else setRunning(false);
    };
    setTimeout(step, 0);
  }

  const st = stats ?? emptyStats();
  const has = st.scanned > 0;
  const perCustUs = has ? (st.ms * 1000) / st.scanned : 0;
  const fullKbcSec = (perCustUs * 2_300_000) / 1e6;
  const totalChannels = CHANNELS.reduce((a, c) => a + (st.channels[c.id] ?? 0), 0);
  const maxHold = Math.max(1, st.none, ...HOLDS.map((h) => st.held[h.id] ?? 0));
  const sampleIds = st.samples[filter] ?? [];
  const filterName = filter === "none" ? "Nothing worth saying" : HOLDS.find((h) => h.id === filter)?.label ?? MOMENTS.find((m) => m.id === filter)?.label;

  return (
    <section className="night-surface flex min-h-[calc(100dvh-60px)] min-w-0 flex-1 flex-col gap-10 px-5 py-8 text-white lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-tight">Tonight at KBC</h1>
          <p className="mt-2 text-[17px] text-white/70">Every customer, every night: one best action, or none. Protection is never rationed.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="size">Population</label>
          <select
            id="size"
            value={size}
            disabled={running}
            onChange={(e) => setSize(Number(e.target.value))}
            className="h-11 rounded-lg border border-white/20 bg-night-2 px-3 text-[15px] text-white"
          >
            {SIZES.map((x) => <option key={x.n} value={x.n}>{x.label}</option>)}
          </select>
          {running ? (
            <button onClick={() => (stop.current = true)} className="h-11 rounded-lg border border-white/30 px-5 font-semibold">Stop</button>
          ) : (
            <button onClick={() => run()} className="h-11 rounded-lg bg-signal px-5 font-bold text-night hover:brightness-110">
              {has ? "Run again" : "Run the nightly pass"}
            </button>
          )}
        </div>
      </header>

      {/* the funnel: the one bold element */}
      <div>
        <Funnel label="Customers scanned" value={st.scanned} of={Math.max(1, st.scanned)} tone="bg-white/85" />
        <Funnel label="Moments detected" value={st.moments} of={Math.max(1, st.scanned)} tone="bg-signal/60" />
        <Funnel label="Shown to a customer" value={st.withAction} of={Math.max(1, st.scanned)} tone="bg-signal" strong />
        <div className="mt-1 h-1 overflow-hidden rounded bg-white/10" aria-hidden>
          <div className="h-full bg-signal transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px] text-white/75">
          <span>
            {has ? (
              <>
                {fmt(st.scanned)} customers in <b className="text-white">{(st.ms / 1000).toFixed(1)} s</b>, {perCustUs.toFixed(1)} µs each. All of KBC fits in about {Math.max(1, Math.round(fullKbcSec))} s on one browser thread.
              </>
            ) : (
              "Customers are generated from a seed on the fly and never stored, so memory stays flat at 2.3 million."
            )}
          </span>
          <span className="flex items-center gap-3">
            <label htmlFor="budget" className="text-white">Attention budget</label>
            <input
              id="budget"
              type="range" min={1} max={5} value={budget} disabled={running}
              onChange={(e) => { const b = Number(e.target.value); setBudget(b); if (has) run(b); }}
              className="w-32 accent-[#00AEEF]"
            />
            <b className="tabular text-white">{budget} per week</b>
          </span>
        </div>
        {has && (
          <p className="mt-2 text-[14px] text-white/55">
            {fmt(st.moments - st.withAction)} interruptions saved. Priority = urgency × confidence × relevance to this customer − the cost of interrupting.
          </p>
        )}
      </div>

      {/* five people */}
      <div>
        <h2 className="text-[20px] font-bold">Five customers to open</h2>
        <div className="mt-3 grid gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-5">
          {HEROES.map((h) => {
            const on = selectedId === h.id;
            return (
              <button
                key={h.id}
                onClick={() => onSelect(h.id)}
                className={`flex flex-col gap-1 p-4 text-left transition ${on ? "bg-signal text-night" : "bg-night-2 hover:bg-night-3"}`}
              >
                <span className="text-[16px] font-bold">{h.customer.name.split(" ")[0]}, {h.customer.age}</span>
                <span className={`text-[13px] leading-snug ${on ? "text-night/80" : "text-white/65"}`}>{h.label.split(" · ")[1]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {has && (
        <div className="grid gap-10 xl:grid-cols-2">
          <div className="flex flex-col gap-10">
            <div>
              <h2 className="text-[20px] font-bold">What it caught</h2>
              <dl className="mt-3 grid grid-cols-2 gap-y-5 border-t border-white/15 pt-4">
                <Figure k="Scam payments paused" v={fmt(st.impact.scamsPaused)} note={`${eurShort(st.impact.scamEurPaused)} kept from scammers`} red />
                <Figure k="Overdrafts seen coming" v={fmt(st.impact.overdraftsCaught)} note="flagged before the account went negative" />
                <Figure k="Bills paid twice" v={fmt(st.chosen.duplicate_bill ?? 0)} note={`${eurShort(st.impact.duplicateEur)} to get back`} />
                <Figure k="Idle money given a goal" v={eurShort(st.impact.idleEur)} note="above 3 months of expenses" />
              </dl>
            </div>

            <div>
              <h2 className="text-[20px] font-bold">Why the rest stayed quiet</h2>
              <ul className="mt-3 border-t border-white/15">
                <HoldRow label="Nothing worth saying" value={st.none} max={maxHold} active={filter === "none"} onClick={() => setFilter("none")} calm />
                {HOLDS.map((h) => (
                  <HoldRow key={h.id} label={h.label} value={st.held[h.id] ?? 0} max={maxHold} active={filter === h.id} onClick={() => setFilter(h.id)} />
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div>
              <h2 className="text-[20px] font-bold">Moments, by what they do for the customer</h2>
              <div className="mt-3 border-t border-white/15">
                {PILLARS.map((p) => (
                  <div key={p.id} className="border-b border-white/15 py-3">
                    <div className="flex items-center gap-2 text-[14px] font-semibold text-white/80">
                      <span className={`h-2 w-2 rounded-full ${p.dot}`} /> {p.label}
                    </div>
                    <ul className="mt-1">
                      {MOMENTS.filter((m) => m.pillar === p.id).map((m) => (
                        <li key={m.id}>
                          <button
                            onClick={() => setFilter(m.id as MomentId)}
                            className={`grid w-full grid-cols-[1fr_auto_auto] items-baseline gap-4 rounded px-2 py-1 text-left text-[15px] ${filter === m.id ? "bg-white/10" : "hover:bg-white/5"}`}
                          >
                            <span>{m.label}{m.realtime && <span className="ml-2 text-[12px] text-signal">live</span>}</span>
                            <span className="tabular text-white/50">{fmt(st.detectedBy[m.id] ?? 0)}</span>
                            <span className="tabular w-16 text-right font-semibold">{fmt(st.chosen[m.id] ?? 0)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="flex justify-end gap-4 px-2 pt-1 text-[12px] text-white/45"><span>detected</span><span className="w-16 text-right">shown</span></div>
              </div>
            </div>

            <div>
              <h2 className="text-[20px] font-bold">One decision, the right channel</h2>
              <div className="mt-3 flex h-3 overflow-hidden rounded">
                {CHANNELS.map((c) => (
                  <div key={c.id} className={c.cls} style={{ width: `${((st.channels[c.id] ?? 0) / Math.max(1, totalChannels)) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-white/75">
                {CHANNELS.map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${c.cls}`} />{c.label} <span className="tabular text-white">{fmt(st.channels[c.id] ?? 0)}</span></li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-[20px] font-bold">{filterName}</h2>
              <p className="text-[14px] text-white/55">Open any of these customers in the app.</p>
              <div className="mt-3 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                {sampleIds.length === 0 && <span className="text-[14px] text-white/55">Nobody in this run.</span>}
                {sampleIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => onSelect(id)}
                    className={`tabular rounded-md px-2 py-1 text-[13px] ${selectedId === id ? "bg-signal text-night" : "bg-white/10 hover:bg-white/20"}`}
                  >
                    #{id}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-white/15 pt-6">
        <h2 className="text-[20px] font-bold">What we refuse to detect</h2>
        <ul className="mt-2 grid gap-x-8 gap-y-1 text-[15px] text-white/70 md:grid-cols-2">
          {NOT_DETECTED.map((x) => <li key={x.label}><span className="text-white">{x.label}</span> {x.why}</li>)}
        </ul>
      </div>
    </section>
  );
}

function Funnel({ label, value, of, tone, strong }: { label: string; value: number; of: number; tone: string; strong?: boolean }) {
  const w = value === 0 ? 0 : Math.max(1.5, (value / of) * 100);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 py-2">
      <div>
        <div className="text-[15px] text-white/70">{label}</div>
        <div className="mt-1 h-3 rounded-sm bg-white/5">
          <div className={`h-full rounded-sm transition-[width] duration-300 ${tone}`} style={{ width: `${w}%` }} />
        </div>
      </div>
      <div className={`tabular text-right leading-none ${strong ? "text-[44px] font-extrabold text-signal" : "text-[32px] font-bold"}`}>{fmt(value)}</div>
    </div>
  );
}

function Figure({ k, v, note, red }: { k: string; v: string; note: string; red?: boolean }) {
  return (
    <div className="pr-4">
      <dt className="text-[14px] text-white/65">{k}</dt>
      <dd className={`tabular text-[28px] font-extrabold leading-tight ${red ? "text-[#FF6B7A]" : ""}`}>{v}</dd>
      <dd className="text-[13px] text-white/55">{note}</dd>
    </div>
  );
}

function HoldRow({ label, value, max, active, onClick, calm }: { label: string; value: number; max: number; active: boolean; onClick: () => void; calm?: boolean }) {
  return (
    <li className="border-b border-white/10">
      <button onClick={onClick} className={`grid w-full grid-cols-[minmax(0,1fr)_7rem_4.5rem] items-center gap-3 px-2 py-2 text-left text-[15px] ${active ? "bg-white/10" : "hover:bg-white/5"}`}>
        <span>{label}</span>
        <span className="h-1.5 rounded-sm bg-white/5"><span className={`block h-full rounded-sm ${calm ? "bg-calm" : "bg-white/50"}`} style={{ width: `${(value / max) * 100}%` }} /></span>
        <span className="tabular text-right">{fmt(value)}</span>
      </button>
    </li>
  );
}
