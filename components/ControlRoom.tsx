"use client";

import { useRef, useState } from "react";
import { MOMENTS, NOT_DETECTED, type MomentId, type Pillar } from "@/lib/moments";
import { POLICY, type HoldReason } from "@/lib/orchestrator";
import { emptyStats, runChunk, type Consent, type PassStats, type SampleKey } from "@/lib/pass";
import type { Channel } from "@/lib/population";

const SIZES = [
  { n: 100_000, label: "100k" },
  { n: 1_000_000, label: "1M" },
  { n: 2_300_000, label: "2.3M (all of KBC)" },
];
const CHUNK = 25_000;

const PILLAR_CLS: Record<Pillar, string> = {
  protect: "bg-crit-soft text-crit",
  support: "bg-warn-soft text-warn",
  guide: "bg-good-soft text-good",
};
const HOLD_LABEL: Record<HoldReason, string> = {
  low_confidence: "Not sure enough",
  no_consent: "Held by consent",
  contact_budget: "Held by contact budget",
  lower_priority: "Queued behind a more important moment",
};
const CHANNEL_LABEL: Record<Channel, string> = { app: "App card", push: "Push", kate: "Kate chat", email: "Email", advisor: "Advisor" };
const CHANNEL_CLS: Record<Channel, string> = { app: "bg-accent", push: "bg-brand", kate: "bg-[#6c5ce7]", email: "bg-ink-3", advisor: "bg-good" };

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const eurM = (n: number) => (n >= 1e6 ? `€${(n / 1e6).toFixed(1)}M` : `€${fmt(n / 1000)}k`);

export function ControlRoom({
  stats,
  setStats,
  overrides,
  selectedId,
  onSelect,
}: {
  stats: PassStats | null;
  setStats: (s: PassStats) => void;
  overrides: Map<number, Consent>;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [size, setSize] = useState(SIZES[2].n);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState<SampleKey>("scam_in_progress");
  const stop = useRef(false);

  function run() {
    const s = emptyStats();
    const total = size;
    let i = 0;
    stop.current = false;
    setRunning(true);
    const step = () => {
      const end = Math.min(total, i + CHUNK);
      runChunk(s, i, end, overrides);
      i = end;
      setProgress(i / total);
      setStats({ ...s });
      if (i < total && !stop.current) setTimeout(step, 0);
      else setRunning(false);
    };
    setTimeout(step, 0);
  }

  const st = stats;
  const perCustUs = st && st.scanned ? (st.ms * 1000) / st.scanned : 0;
  const fullKbcSec = (perCustUs * 2_300_000) / 1e6;
  const sampleIds = st?.samples[filter] ?? [];
  const totalChannels = st ? Object.values(st.channels).reduce((a, b) => a + (b || 0), 0) : 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">KBC side · Moments control room</div>
          <h1 className="text-2xl font-bold text-brand">Every customer, every night: one best action, or none.</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={size}
            disabled={running}
            onChange={(e) => setSize(Number(e.target.value))}
            className="h-10 rounded-full border border-line bg-surface px-3 text-sm"
          >
            {SIZES.map((x) => (
              <option key={x.n} value={x.n}>{x.label} customers</option>
            ))}
          </select>
          {running ? (
            <button onClick={() => (stop.current = true)} className="h-10 rounded-full bg-ink-2 px-5 text-sm font-semibold text-white">Stop</button>
          ) : (
            <button onClick={run} className="h-10 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow hover:brightness-110">
              ▶ Run nightly pass
            </button>
          )}
        </div>
      </div>

      {/* progress + throughput */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <div className="text-ink-2">
            <b className="tabular text-ink">{fmt(st?.scanned ?? 0)}</b> synthetic customers scanned
            {st && st.scanned > 0 && (
              <> in <b className="tabular text-ink">{(st.ms / 1000).toFixed(1)}s</b> · <b className="tabular text-ink">{perCustUs.toFixed(1)} µs</b>/customer</>
            )}
          </div>
          {st && st.scanned > 0 && (
            <div className="text-ink-2">
              All 2.3M KBC customers ≈ <b className="text-ink">{fullKbcSec.toFixed(0)}s</b> on one browser thread · embarrassingly parallel
            </div>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="mt-2 text-[12px] text-ink-3">
          signals → recognition (baseline + live state) → moment detection → decision policy → channel → customer approves
        </div>
      </div>

      {!st ? (
        <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-line p-10 text-center text-ink-3">
          Press “Run nightly pass”. Customers are generated from seeds on the fly, never stored.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Moments detected" value={fmt(st.detected)} sub={`${pct(st.detected, st.scanned)} of customers`} />
            <Kpi label="Actions sent" value={fmt(st.withAction)} sub="one per customer, max" tone="accent" />
            <Kpi label="No action needed" value={fmt(st.none)} sub="silence is a feature" tone="good" onClick={() => setFilter("none")} active={filter === "none"} />
            <Kpi label="Held by consent" value={fmt(st.held.no_consent ?? 0)} sub="offers switched off" onClick={() => setFilter("no_consent")} active={filter === "no_consent"} />
            <Kpi label="Held by contact budget" value={fmt(st.held.contact_budget ?? 0)} sub={`max 1 per ${POLICY.contactBudgetDays} days`} onClick={() => setFilter("contact_budget")} active={filter === "contact_budget"} />
          </div>

          {/* impact */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Impact label="Scam payments paused" value={fmt(st.impact.scamsPaused)} sub={`${eurM(st.impact.scamEurPaused)} kept from scammers`} tone="crit" />
            <Impact label="Overdrafts caught early" value={fmt(st.impact.overdraftsCaught)} sub="before the account went negative" tone="warn" />
            <Impact label="Double payments caught" value={fmt(st.chosen.duplicate_bill ?? 0)} sub={`${eurM(st.impact.duplicateEur)} to refund`} tone="warn" />
            <Impact label="Idle savings surfaced" value={eurM(st.impact.idleEur)} sub="above a 6-month buffer" tone="good" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            {/* moments table */}
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">Moment library</div>
              <table className="w-full text-sm">
                <thead className="text-left text-[12px] text-ink-3">
                  <tr>
                    <th className="py-1 font-medium">Moment</th>
                    <th className="font-medium">Pillar</th>
                    <th className="font-medium">When</th>
                    <th className="text-right font-medium">Detected</th>
                    <th className="text-right font-medium">Acted</th>
                  </tr>
                </thead>
                <tbody>
                  {MOMENTS.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => setFilter(m.id)}
                      className={`cursor-pointer border-t border-line hover:bg-surface-2 ${filter === m.id ? "bg-accent-soft" : ""}`}
                    >
                      <td className="py-1.5 font-medium">
                        {m.label}
                        <span className="ml-1 text-[11px] text-ink-3">{m.productLine}{m.commercial ? " · offer" : ""}</span>
                      </td>
                      <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILLAR_CLS[m.pillar]}`}>{m.pillar}</span></td>
                      <td className="text-[12px] text-ink-2">{m.realtime ? "live" : "nightly"}</td>
                      <td className="tabular text-right">{fmt(st.detectedBy[m.id] ?? 0)}</td>
                      <td className="tabular text-right font-semibold">{fmt(st.chosen[m.id] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4">
              {/* channels */}
              <div className="rounded-2xl border border-line bg-surface p-4">
                <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">One brain, every channel</div>
                <div className="flex h-3 overflow-hidden rounded-full">
                  {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
                    <div key={c} className={CHANNEL_CLS[c]} style={{ width: `${((st.channels[c] ?? 0) / Math.max(1, totalChannels)) * 100}%` }} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-2">
                  {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
                    <span key={c} className="inline-flex items-center gap-1">
                      <span className={`h-2 w-2 rounded-full ${CHANNEL_CLS[c]}`} />
                      {CHANNEL_LABEL[c]} <b className="tabular">{fmt(st.channels[c] ?? 0)}</b>
                    </span>
                  ))}
                </div>
              </div>

              {/* customers */}
              <div className="rounded-2xl border border-line bg-surface p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Customers · {filterLabel(filter)}</div>
                  <div className="text-[11px] text-ink-3">click to open their app</div>
                </div>
                <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                  {sampleIds.length === 0 && <div className="text-sm text-ink-3">None in this run.</div>}
                  {sampleIds.map((id) => (
                    <button
                      key={id}
                      onClick={() => onSelect(id)}
                      className={`tabular rounded-full border px-2.5 py-1 text-[12px] ${selectedId === id ? "border-accent bg-accent text-white" : "border-line hover:border-accent"}`}
                    >
                      #{id}
                    </button>
                  ))}
                </div>
              </div>

              {/* not detected */}
              <div className="rounded-2xl border border-line bg-surface p-4">
                <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">Moments we deliberately don't detect</div>
                <ul className="space-y-1 text-[13px] text-ink-2">
                  {NOT_DETECTED.map((x) => (
                    <li key={x.label}>🚫 <b className="text-ink">{x.label}</b> {x.why}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function filterLabel(k: SampleKey) {
  if (k === "none") return "no action needed";
  if (k in HOLD_LABEL) return HOLD_LABEL[k as HoldReason];
  return MOMENTS.find((m) => m.id === (k as MomentId))?.label ?? k;
}

const pct = (a: number, b: number) => `${b ? Math.round((a / b) * 100) : 0}%`;

function Kpi({ label, value, sub, tone, onClick, active }: { label: string; value: string; sub: string; tone?: "accent" | "good"; onClick?: () => void; active?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border bg-surface p-3 ${active ? "border-accent" : "border-line"} ${onClick ? "cursor-pointer hover:border-accent/50" : ""}`}
    >
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className={`tabular text-2xl font-bold ${tone === "accent" ? "text-accent" : tone === "good" ? "text-good" : "text-ink"}`}>{value}</div>
      <div className="text-[11px] text-ink-3">{sub}</div>
    </div>
  );
}

function Impact({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "crit" | "warn" | "good" }) {
  const cls = { crit: "bg-crit-soft text-crit", warn: "bg-warn-soft text-warn", good: "bg-good-soft text-good" }[tone];
  return (
    <div className={`rounded-2xl p-3 ${cls}`}>
      <div className="text-[12px] font-medium opacity-80">{label}</div>
      <div className="tabular text-xl font-bold">{value}</div>
      <div className="text-[11px] opacity-80">{sub}</div>
    </div>
  );
}
