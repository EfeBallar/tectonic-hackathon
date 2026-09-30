"use client";

import { useRef, useState } from "react";
import { NOT_DETECTED } from "@/lib/moments";
import { emptyStats, runChunk, type Patch, type PassStats } from "@/lib/pass";

const SIZES = [
  { n: 100_000, label: "100,000 customers" },
  { n: 1_000_000, label: "1 million customers" },
  { n: 2_300_000, label: "All 2.3 million customers" },
];
const CHUNK = 25_000;

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
      if (i < total && !stop.current) setTimeout(step, 0);
      else { setStats({ ...s }); setRunning(false); }
    };
    setTimeout(step, 0);
  }

  const st = stats ?? emptyStats();
  const has = st.scanned > 0;
  const perCustUs = has ? (st.ms * 1000) / st.scanned : 0;
  const fullKbcSec = (perCustUs * 2_300_000) / 1e6;

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
        <Funnel label="Customers scanned" value={running ? 0 : st.scanned} of={Math.max(1, st.scanned)} tone="bg-white/85" />
        <Funnel label="Moments detected" value={running ? 0 : st.moments} of={Math.max(1, st.scanned)} tone="bg-signal/60" />
        <Funnel label="Shown to a customer" value={running ? 0 : st.withAction} of={Math.max(1, st.scanned)} tone="bg-signal" strong />
        <div className="mt-1 h-1 overflow-hidden rounded bg-white/10" aria-hidden>
          <div className="h-full bg-signal" style={{ width: `${running ? progress * 100 : 0}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px] text-white/75">
          <span>
            {running ? (
              `Scanning ${SIZES.find((x) => x.n === size)?.label.toLowerCase()}…`
            ) : has ? (
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
        {has && !running && (
          <p className="mt-2 text-[14px] text-white/55">
            {fmt(st.moments - st.withAction)} interruptions saved. Priority = urgency × confidence × relevance to this customer − the cost of interrupting.
          </p>
        )}
      </div>

      {has && !running && (
        <div>
          <h2 className="text-[20px] font-bold">What it caught tonight</h2>
          <dl className="mt-3 grid grid-cols-2 gap-y-5 border-t border-white/15 pt-4 md:grid-cols-4">
            <Figure k="Scam payments paused" v={fmt(st.impact.scamsPaused)} note={`${eurShort(st.impact.scamEurPaused)} kept from scammers`} red />
            <Figure k="Overdrafts seen coming" v={fmt(st.impact.overdraftsCaught)} note="before the account went negative" />
            <Figure k="Bills paid twice" v={fmt(st.chosen.duplicate_bill ?? 0)} note={`${eurShort(st.impact.duplicateEur)} to get back`} />
            <Figure k="Idle money given a goal" v={eurShort(st.impact.idleEur)} note="above 3 months of expenses" />
          </dl>
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
          <div className={`h-full rounded-sm ${tone}`} style={{ width: `${w}%` }} />
        </div>
      </div>
      <div className={`tabular text-right leading-none ${strong ? "text-[44px] font-extrabold text-signal" : "text-[32px] font-bold"}`}>{value ? fmt(value) : "–"}</div>
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
