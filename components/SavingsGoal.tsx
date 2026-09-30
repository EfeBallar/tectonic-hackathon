"use client";

import { useId, useState } from "react";
import { idleSurplus } from "@/lib/moments";
import type { Customer } from "@/lib/population";

// PM: gamify the savings goal per customer. The goal is an object from their life stage
// that fills up as they save. Milestones give them something to reach before the end.

type Shape = "car" | "house" | "cap" | "suitcase";
export interface GoalOption { id: string; label: string; target: number; shape: Shape; milestones: [string, string, string, string] }

export function goalsFor(c: Customer): GoalOption[] {
  const car: GoalOption = { id: "car", label: c.age < 26 ? "My first car" : "A new car", target: c.age < 26 ? 8000 : 15000, shape: "car", milestones: ["Wheels", "Doors", "Engine", "Keys"] };
  const trip: GoalOption = { id: "trip", label: "A big trip", target: 3000, shape: "suitcase", milestones: ["Tickets", "Hotel", "Spending money", "Packed"] };
  const home: GoalOption = { id: "home", label: "Deposit for a home", target: 30000, shape: "house", milestones: ["Foundation", "Walls", "Roof", "Keys"] };
  const reno: GoalOption = { id: "reno", label: "Renovating the house", target: 25000, shape: "house", milestones: ["Plans", "Kitchen", "Bathroom", "Done"] };
  const uni: GoalOption = { id: "uni", label: "Our kid's university", target: 20000, shape: "cap", milestones: ["Year 1", "Year 2", "Year 3", "Graduation"] };
  if (c.age < 26) return [car, trip];
  if (c.age >= 55) return [reno, trip];
  if (c.segment === "family") return [uni, reno, car];
  return [home, car, trip];
}

const eur = (n: number) => `€${Math.round(n).toLocaleString("nl-BE")}`;
const monthName = (months: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

export function GoalShape({ shape, pct, size = 120, coinKey }: { shape: Shape; pct: number; size?: number; coinKey?: number }) {
  const id = useId().replace(/:/g, "");
  const level = 100 - Math.max(0, Math.min(1, pct)) * 100;
  const path = SHAPES[shape];
  // a repeating wave, twice as wide as the shape, drifting sideways
  let wave = `M0 0`;
  for (let x = 0; x <= 150; x += 25) wave += ` Q ${x + 12.5} -4 ${x + 25} 0`;
  wave += ` L 175 120 L 0 120 Z`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${Math.round(pct * 100)}% saved`} className="overflow-visible">
      <defs>
        <clipPath id={`clip-${id}`}><path d={path} /></clipPath>
        <linearGradient id={`liq-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3fb57f" />
          <stop offset="1" stopColor="#1f8a5b" />
        </linearGradient>
      </defs>
      <path d={path} fill="var(--color-accent-soft)" />
      <g clipPath={`url(#clip-${id})`}>
        <g style={{ transform: `translateY(${level}px)`, transition: "transform 0.9s cubic-bezier(.34,1.3,.5,1)" }}>
          <path className="goal-wave" d={wave} fill={`url(#liq-${id})`} />
        </g>
      </g>
      <path d={path} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinejoin="round" />
      {coinKey !== undefined && coinKey > 0 && (
        <g key={coinKey} className="coin" style={{ transformOrigin: "50px 10px" }}>
          <circle cx="50" cy="10" r="6" fill="#f2c14e" stroke="#b8871b" strokeWidth="1.2" />
          <text x="50" y="12.6" textAnchor="middle" fontSize="7" fontWeight="800" fill="#8a6412">€</text>
        </g>
      )}
    </svg>
  );
}

const SHAPES: Record<Shape, string> = {
  house: "M50 8 L92 44 L82 44 L82 92 L18 92 L18 44 L8 44 Z",
  car: "M10 70 L10 55 L22 52 L32 34 L68 34 L80 52 L92 56 L92 70 L80 70 A10 10 0 0 0 60 70 L40 70 A10 10 0 0 0 20 70 Z",
  cap: "M50 18 L96 38 L50 58 L4 38 Z M24 47 L24 70 Q50 86 76 70 L76 47 L50 58 Z",
  suitcase: "M36 22 L64 22 L64 32 L86 32 L86 88 L14 88 L14 32 L36 32 Z",
};

export function SavingsGoalSheet({ customer: c, onClose, onDone }: { customer: Customer; onClose: () => void; onDone: (label: string) => void }) {
  const options = goalsFor(c);
  const [goal, setGoal] = useState(options[0]);
  const surplus = Math.max(0, idleSurplus(c));
  const [moveIdle, setMoveIdle] = useState(surplus > 0);
  const [monthly, setMonthly] = useState(Math.max(25, Math.round((c.salaryNow * 0.08) / 25) * 25));
  const [coin, setCoin] = useState(0);
  const [preview, setPreview] = useState(0); // months fast-forwarded in the preview
  const start = Math.min(goal.target, (moveIdle ? Math.min(surplus, goal.target) : 0) + preview * monthly);
  const pct = start / goal.target;
  const months = Math.max(0, Math.ceil((goal.target - start) / monthly));
  const nextMilestone = [0.25, 0.5, 0.75, 1].findIndex((m) => pct < m);
  const monthsToNext = nextMilestone < 0 ? 0 : Math.max(0, Math.ceil(((nextMilestone + 1) * 0.25 * goal.target - start) / monthly));

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="anim-fade absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="anim-sheet relative max-h-[92%] overflow-y-auto rounded-t-3xl bg-surface p-5 no-scrollbar">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-bold">Give your money a goal</h3>
          <button onClick={onClose} className="text-ink-3" aria-label="Close">✕</button>
        </div>

        <div className="mt-3 flex gap-1.5">
          {options.map((o) => (
            <button key={o.id} onClick={() => { setGoal(o); setPreview(0); }} className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${goal.id === o.id ? "bg-brand text-white" : "bg-surface-2 text-ink-2"}`}>
              {o.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-4">
          <GoalShape shape={goal.shape} pct={pct} size={128} coinKey={coin} />
          <div>
            <div className="tabular text-[34px] font-extrabold leading-none">{Math.round(pct * 100)}%</div>
            <div className="text-[13px] text-ink-2">{eur(start)} of {eur(goal.target)}</div>
            <div className="mt-2 text-[13px]">Full in <b>{monthName(months)}</b></div>
          </div>
        </div>

        <ol className="mt-4 grid grid-cols-4 gap-1 text-center text-[11px]">
          {goal.milestones.map((m, i) => {
            const reached = pct >= (i + 1) * 0.25;
            return (
              <li key={`${m}-${reached}`} className={`${reached ? "milestone-pop " : ""}rounded-md px-1 py-1.5 ${reached ? "bg-good-soft font-semibold text-good" : i === nextMilestone ? "bg-accent-soft text-brand" : "bg-surface-2 text-ink-3"}`}>
                {m}
              </li>
            );
          })}
        </ol>
        {nextMilestone >= 0 && (
          <p className="mt-2 text-[13px] text-ink-2">Next up: <b className="text-ink">{goal.milestones[nextMilestone]}</b>, {monthsToNext <= 1 ? "next month" : `in ${monthsToNext} months`}.</p>
        )}

        <label className="mt-4 block text-[14px] font-semibold" htmlFor="monthly">Every month, the day your salary lands</label>
        <div className="flex items-center gap-3">
          <input id="monthly" type="range" min={25} max={600} step={25} value={monthly} onChange={(e) => { setMonthly(Number(e.target.value)); setCoin((k) => k + 1); }} className="flex-1 accent-[var(--color-calm)]" />
          <span className="tabular w-16 text-right text-[15px] font-bold">{eur(monthly)}</span>
        </div>

        <button
          onClick={() => { setPreview((p) => p + 1); setCoin((k) => k + 1); }}
          disabled={pct >= 1}
          className="mt-3 text-[13px] font-semibold text-accent disabled:text-ink-3"
        >
          {pct >= 1 ? "Goal reached in this preview" : `Preview: add month ${preview + 1}`}
        </button>

        {surplus > 0 && (
          <label className="mt-3 flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={moveIdle} onChange={(e) => setMoveIdle(e.target.checked)} className="h-4 w-4 accent-[var(--color-calm)]" />
            Start with the {eur(Math.min(surplus, goal.target))} that&apos;s sitting still
          </label>
        )}

        <button onClick={() => onDone(goal.label)} className="mt-5 h-12 w-full rounded-full bg-calm text-[15px] font-semibold text-white">
          Start saving for {goal.label.toLowerCase()}
        </button>
        <p className="mt-2 text-center text-[12px] text-ink-3">You can pause or stop it any time. Nothing moves until you confirm.</p>
      </div>
    </div>
  );
}
