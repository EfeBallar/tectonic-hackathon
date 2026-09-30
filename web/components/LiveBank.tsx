"use client";

// Live tab: the same customer experience, driven by kate-api on Google Cloud.
// Login, the one message the backend chose, feedback, ElevenLabs read-aloud and voice all use the
// same authenticated customer. Nothing here is decided in the browser.

import { useEffect, useRef, useState } from "react";
import { kate, startVoice, type Attention, type Conversation, type Nudge, type Persona, type Profile, type RaceEntry, type Txn } from "@/lib/kate";
import type { ProjectionPoint } from "@/lib/types";
import { eur, fmtDate } from "@/lib/util";
import { ProjectionChart } from "./ProjectionChart";
import { IconInfo, IconMic, IconRefresh, IconShield, IconSpeaker } from "./Icons";

const OPEN = new Set(["new", "snoozed"]);
const LABEL: Record<string, string> = {
  cashflow_risk: "Overdraft coming",
  moved_house: "New home",
  first_salary: "First salary",
  salary_increase: "Salary rise",
  salary_decrease: "Salary drop",
  growing_family: "Growing family",
  travelling_abroad: "Abroad",
  vehicle_purchase: "New vehicle",
};
const TOPICS: [string, string][] = [["cashflow", "Money running low"], ["housing", "Moving house"], ["income", "Salary changes"], ["family", "Family"], ["travel", "Travel"], ["mobility", "Car and transport"]];
const VERDICT: Record<string, string> = {
  selected: "won the slot",
  outranked: "lost the slot to a higher priority",
  budget_full: "waits: this week's budget is used up",
  not_worth_it: "dropped: not worth an interruption for this person",
};

type Session = { token: string; profile: Profile };
type Voice = { status: string; lines: { who: "kate" | "you"; text: string }[] };

const f2 = (n: number) => n.toFixed(2);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function forecastPoints(n: Nudge): { points: ProjectionPoint[]; lowest: number; salary?: string } | null {
  const daily = n.evidence?.daily_balance as number[] | undefined;
  const fc = n.evidence?.forecast as { start_balance: number; next_salary_on: string | null; upcoming_debits: { counterparty: string; amount: number; on: string }[] } | undefined;
  if (!daily?.length || !fc) return null;
  const start = new Date(n.created_at);
  const iso = (d: number) => new Date(start.getTime() + d * 86400000).toISOString().slice(0, 10);
  const points: ProjectionPoint[] = [fc.start_balance, ...daily].map((balance, day) => ({
    day,
    date: iso(day),
    balance,
    events: fc.upcoming_debits.filter((u) => u.on === iso(day)).map((u) => ({ label: u.counterparty, amount: u.amount })),
  }));
  const lowest = points.reduce((lo, p) => (p.balance < points[lo].balance ? p.day : lo), 0);
  return { points, lowest, salary: fc.next_salary_on ?? undefined };
}

export function LiveBank() {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [pick, setPick] = useState("");
  const [code, setCode] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [att, setAtt] = useState<Attention | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  const [voice, setVoice] = useState<Voice | null>(null);
  const conv = useRef<Conversation | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    kate.personas().then((all) => { const p = all.filter(x => x.customer_id.startsWith("D")); setPersonas(p); setPick(p[0]?.customer_id ?? ""); }).catch((e) => setError(message(e)));
    return () => { stopAudio(); void conv.current?.endSession(); };
  }, []);

  function stopAudio() {
    if (!player.current) return;
    player.current.pause();
    URL.revokeObjectURL(player.current.src);
    player.current = null;
  }

  async function endVoice() {
    const c = conv.current;
    conv.current = null;
    await c?.endSession();
    setVoice(null);
  }

  async function refresh(token: string) {
    // An older backend may not expose the newer budget view yet.
    const [n, t, a] = await Promise.all([kate.nudges(token), kate.transactions(token), kate.attention(token).catch(() => null)]);
    setNudges(n);
    setTxns(t);
    setAtt(a);
    return n;
  }

  async function run(label: string, fn: () => Promise<void>) {
    setError(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  }

  const login = () => run("Signing in…", async () => {
    await endVoice();
    stopAudio();
    const res = await kate.login(code.trim(), pick);
    setSession({ token: res.token, profile: res.customer });
    setWhy(false);
    await refresh(res.token);
  });

  async function logout() {
    await endVoice();
    stopAudio();
    setSession(null);
    setNudges([]);
    setTxns([]);
    setAtt(null);
  }

  // A scripted life event goes through Pub/Sub -> kate-engine -> Firestore, like a real payment.
  const fire = (eventId: string) => run("Payment sent to Pub/Sub. Waiting for kate-engine…", async () => {
    if (!session) return;
    const before = new Set(nudges.map((n) => n.nudge_id));
    await kate.event(session.token, eventId);
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const list = await refresh(session.token);
      if (list.some((n) => !before.has(n.nudge_id))) return;
    }
    setError("No new message after 30 s. The engine may have held it back (budget, cooldown, consent); every decision is in BigQuery.");
  });

  const answer = (n: Nudge, r: "accepted" | "dismissed" | "snoozed") => run("Saving your answer…", async () => {
    if (!session) return;
    await kate.respond(session.token, n.nudge_id, r);
    await refresh(session.token);
  });

  const setTopic = (topic: string, muted: boolean) => run(muted ? "Turning that off…" : "Turning that back on…", async () => {
    if (!session) return;
    const profile = await kate.setTopic(session.token, topic, muted);
    setSession({ ...session, profile });
  });

  const reset = () => run("Resetting this persona…", async () => {
    if (!session) return;
    await endVoice();
    await kate.reset(session.token);
    setSession({ ...session, profile: await kate.me(session.token) });
    await refresh(session.token);
  });

  const listen = (n: Nudge) => run("Kate is recording…", async () => {
    if (!session) return;
    stopAudio();
    const url = await kate.audioUrl(session.token, n.nudge_id);
    const a = new Audio(url);
    a.onended = () => stopAudio();
    player.current = a;
    await a.play();
  });

  const talk = (n?: Nudge) => run("Connecting to Kate…", async () => {
    if (!session) return;
    await endVoice();
    stopAudio();
    setVoice({ status: "connecting", lines: [] });
    try {
      const s = await kate.voiceSession(session.token, n?.nudge_id);
      conv.current = await startVoice(s, {
        status: (status) => setVoice((v) => (v ? { ...v, status } : v)),
        message: (who, text) => setVoice((v) => (v ? { ...v, lines: [...v.lines, { who, text }] } : v)),
      });
    } catch (e) {
      setVoice(null);
      throw e;
    }
  });

  const current = nudges.find((n) => OPEN.has(n.status)) ?? null;
  const latest = current ?? nudges[0] ?? null;
  const balance = txns.find((t) => t.balance_after != null)?.balance_after ?? null;
  const persona = personas?.find((p) => p.customer_id === session?.profile.customer_id);
  const fc = current ? forecastPoints(current) : null;
  const first = session?.profile.first_name ?? "";

  return (
    <main id="main" className="mx-auto grid max-w-[1200px] items-start gap-8 px-5 pb-10 pt-4 lg:grid-cols-[minmax(0,0.9fr)_390px_minmax(0,1.1fr)] lg:px-10">
      <section aria-label="Sign in" className="order-2 lg:order-1">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Live on Google Cloud</h1>
        <p className="mt-2 max-w-sm text-[15px] text-ink-2">
          Real backend: Cloud Run, Firestore, BigQuery, Pub/Sub, Gemini, and ElevenLabs voice. Synthetic customers only.
        </p>

        {!session ? (
          <div className="mt-5 space-y-3">
            {personas === null && !error && <p className="text-[14px] text-ink-3">Loading customers from kate-api…</p>}
            <ul className="space-y-1">
              {personas?.map((p) => (
                <li key={p.customer_id}>
                  <button onClick={() => setPick(p.customer_id)} className={`w-full rounded-lg px-3 py-2.5 text-left ${pick === p.customer_id ? "bg-brand text-white" : "hover:bg-white"}`}>
                    <span className="block text-[15px] font-bold">{p.first_name}, {p.age} · {p.city}</span>
                    <span className={`block text-[13px] leading-snug ${pick === p.customer_id ? "text-white/75" : "text-ink-2"}`}>{p.story}</span>
                  </button>
                </li>
              ))}
            </ul>
            {personas && (
              <form onSubmit={(e) => { e.preventDefault(); void login(); }} className="flex gap-2">
                <label className="sr-only" htmlFor="code">Demo access code</label>
                <input id="code" type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Demo access code" className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-[14px]" />
                <button type="submit" disabled={!code || !pick || !!busy} className="rounded-lg bg-brand px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-50">Sign in</button>
              </form>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2.5">
              <span className="text-[14px]"><b>{session.profile.first_name} {session.profile.last_name}</b> · {session.profile.customer_id}</span>
              <button onClick={() => void logout()} className="text-[13px] font-semibold text-accent underline underline-offset-4">Switch</button>
            </div>
            <h2 className="pt-2 text-[15px] font-bold">Make something happen in {first}&apos;s life</h2>
            <ul className="space-y-1.5">
              {persona?.events.map((e) => (
                <li key={e.event_id}>
                  <button disabled={!!busy} onClick={() => void fire(e.event_id)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-left hover:border-accent disabled:opacity-50">
                    <span className="block text-[14px] font-semibold">{e.label}</span>
                    <span className="block text-[12px] text-ink-2">{e.story}</span>
                  </button>
                </li>
              ))}
            </ul>
            <h2 className="pt-2 text-[15px] font-bold">{first}&apos;s controls</h2>
            <ul className="grid grid-cols-2 gap-1.5">
              {TOPICS.map(([topic, label]) => {
                const off = session.profile.muted_topics?.includes(topic);
                return (
                  <li key={topic}>
                    <button role="switch" aria-checked={!off} disabled={!!busy} onClick={() => void setTopic(topic, !off)} className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-[12px] font-semibold disabled:opacity-50 ${off ? "border-line bg-surface-2 text-ink-3" : "border-line bg-white"}`}>
                      <span>{label}</span>
                      <span className={`ml-2 h-2 w-2 shrink-0 rounded-full ${off ? "bg-ink-3" : "bg-good"}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <button disabled={!!busy} onClick={() => void reset()} className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2 hover:text-ink disabled:opacity-50">
              <IconRefresh className="h-4 w-4" /> Reset {first}&apos;s demo
            </button>
          </div>
        )}
        {busy && <p role="status" className="mt-4 text-[13px] text-accent">{busy}</p>}
        {error && <p role="alert" className="mt-4 rounded-lg bg-crit-soft px-3 py-2 text-[13px] text-crit">{error}</p>}
      </section>

      <div className="order-1 flex flex-col items-center gap-3 lg:order-2">
        <div className="phone relative flex shrink-0 flex-col overflow-hidden bg-surface">
          <div className="flex items-center justify-between bg-brand px-6 pb-1 pt-2 text-[12px] font-semibold text-white">
            <span>09:41</span>
            <span className="rounded bg-white/15 px-1.5 text-[10px]">LIVE · GCP</span>
          </div>
          <div className="relative flex-1 overflow-y-auto pb-6 no-scrollbar">
            <div className="bg-brand px-5 pb-14 pt-3 text-white">
              <div className="text-[13px] opacity-70">KBC Mobile</div>
              <div className="text-xl font-bold">{session ? `Hi ${first}` : "Signed out"}</div>
              <div className="mt-3 text-[12px] opacity-80">Current account</div>
              <div className="tabular text-3xl font-bold">{balance != null ? eur(balance) : "–"}</div>
              {att && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] opacity-90">
                  <span>KBC interrupted you</span>
                  {Array.from({ length: att.budget }).map((_, i) => (
                    <span key={i} className={`h-2 w-2 rounded-full ${i < att.used ? "bg-white" : "bg-white/30"}`} />
                  ))}
                  <span>{Math.min(att.used, att.budget)} of {att.budget} times this week</span>
                </div>
              )}
            </div>

            <div className="-mt-10 space-y-3 px-4">
              {!session ? (
                <div className="rounded-xl bg-surface p-4 text-[14px] text-ink-2 shadow-[0_8px_24px_-12px_rgba(10,42,74,0.35)]">Pick a customer and sign in with the demo access code.</div>
              ) : current ? (
                <div className={`anim-pop rounded-xl border-l-4 bg-surface p-4 shadow-[0_8px_24px_-12px_rgba(10,42,74,0.35)] ${current.attention?.protective ? "border-protect" : "border-calm"}`}>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    {current.attention?.protective && <IconShield className="h-3.5 w-3.5 text-protect" />}
                    {LABEL[current.signal_type] ?? current.signal_type}{current.status === "snoozed" ? " · snoozed" : ""}
                  </div>
                  <h3 className="mt-1 text-[17px] font-bold leading-snug">{current.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{current.message}</p>
                  {fc && (
                    <div className="mt-3">
                      <ProjectionChart points={fc.points} buffer={0} endLabel={fc.salary ? `Salary ${fmtDate(fc.salary)}` : "In 30 days"} lowestDay={fc.lowest} />
                    </div>
                  )}
                  <button onClick={() => setWhy(!why)} aria-expanded={why} className="mt-3 flex items-center gap-1 text-[13px] font-semibold text-accent">
                    <IconInfo className="h-4 w-4" /> Why am I seeing this?
                  </button>
                  {why && (
                    <div className="mt-2 rounded-lg bg-surface-2 p-3 text-[13px] leading-relaxed text-ink-2">
                      <p>{current.reason}</p>
                      {current.attention && (
                        <p className="mt-2 text-[12px] text-ink-3">
                          {current.attention.protective ? "Protection is never rationed: this did not use your weekly budget." : `This used 1 of your ${current.attention.budget} interruptions this week.`}
                        </p>
                      )}
                      <button disabled={!!busy} onClick={() => void setTopic(current.topic, true)} className="mt-2 text-[12px] font-semibold text-accent underline underline-offset-4 disabled:opacity-50">
                        Stop messages about {TOPICS.find(([t]) => t === current.topic)?.[1].toLowerCase() ?? current.topic}
                      </button>
                    </div>
                  )}
                  {current.suggested_actions?.length > 0 && (
                    <ul className="mt-3 list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
                      {current.suggested_actions.slice(0, 3).map((a) => <li key={a}>{a}</li>)}
                    </ul>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button disabled={!!busy} onClick={() => void answer(current, "accepted")} className="rounded-lg bg-brand px-3 py-2 text-[14px] font-semibold text-white disabled:opacity-50">Yes, help me</button>
                    <button disabled={!!busy} onClick={() => void answer(current, "snoozed")} className="rounded-lg bg-surface-2 px-3 py-2 text-[14px] font-semibold disabled:opacity-50">Later</button>
                    <button disabled={!!busy} onClick={() => void listen(current)} className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[14px] font-semibold disabled:opacity-50"><IconSpeaker className="h-4 w-4" /> Listen</button>
                    <button disabled={!!busy} onClick={() => void talk(current)} className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[14px] font-semibold disabled:opacity-50"><IconMic className="h-4 w-4" /> Talk to Kate</button>
                  </div>
                  <button disabled={!!busy} onClick={() => void answer(current, "dismissed")} className="mt-2 w-full text-center text-[13px] text-ink-3 hover:text-ink disabled:opacity-50">Not relevant for me</button>
                </div>
              ) : (
                <div className="rounded-xl border-l-4 border-calm bg-surface p-4 shadow-[0_8px_24px_-12px_rgba(10,42,74,0.35)]">
                  <h3 className="text-[16px] font-bold">All calm</h3>
                  <p className="mt-1 text-[14px] text-ink-2">Nothing needs your attention right now. Silence is a feature.</p>
                  <button disabled={!!busy} onClick={() => void talk()} className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-accent disabled:opacity-50"><IconMic className="h-4 w-4" /> Talk to Kate</button>
                </div>
              )}

              {voice && (
                <div className="rounded-xl bg-night p-3 text-white">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-semibold">Kate (ElevenLabs voice) · {voice.status}</span>
                    <button onClick={() => void endVoice()} className="rounded bg-white/15 px-2 py-0.5">End</button>
                  </div>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[13px]">
                    {voice.lines.map((l, i) => <li key={i}><b>{l.who === "kate" ? "Kate" : "You"}:</b> {l.text}</li>)}
                  </ul>
                </div>
              )}

              {session && txns.length > 0 && (
                <div className="rounded-xl bg-surface p-3 shadow-[0_8px_24px_-14px_rgba(10,42,74,0.35)]">
                  <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Recent</div>
                  <ul className="divide-y divide-line">
                    {txns.slice(0, 8).map((t) => (
                      <li key={t.transaction_id} className="flex items-center justify-between py-1.5 text-[13px]">
                        <span className="min-w-0 truncate">{t.counterparty}<span className="ml-1 text-ink-3">{fmtDate(t.booked_at.slice(0, 10))}{t.country !== "BE" ? ` · ${t.country}` : ""}</span></span>
                        <span className={`tabular shrink-0 font-semibold ${t.amount > 0 ? "text-good" : ""}`}>{eur(t.amount, { sign: true })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-center text-[12px] text-ink-3">Hackathon prototype, not an official KBC app. Synthetic data.</p>
      </div>

      <section aria-label="What the backend decided" className="order-3">
        <h2 className="text-[20px] font-bold">{latest ? "Why this message, and not the others" : "One message at a time"}</h2>
        <p className="mt-2 text-[15px] text-ink-2">
          kate-engine scores every moment it detects: urgency × confidence × relevance to this person − interruption cost.
          Only the winner is written by Gemini and shown. Protective moments skip the weekly budget.
        </p>
        {latest?.attention && <Race winner={latest.attention} runners={latest.attention.runners_up} />}
        {att && Object.keys(att.relevance).length > 0 && (
          <div className="mt-5">
            <h3 className="text-[14px] font-bold">Learned from {first}&apos;s answers</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {Object.entries(att.relevance).map(([topic, r]) => (
                <li key={topic} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${r >= 1 ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`}>{topic} × {f2(r)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

function Race({ winner, runners }: { winner: RaceEntry; runners: RaceEntry[] }) {
  const rows = [winner, ...runners];
  return (
    <ol className="mt-5 space-y-2">
      {rows.map((r) => (
        <li key={r.signal_type} className={`rounded-lg border p-3 ${r.decision === "selected" ? "border-brand bg-white" : "border-line bg-white/60"}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-bold">{LABEL[r.signal_type] ?? r.signal_type}</span>
            <span className="tabular text-[13px] font-semibold">{r.protective ? "protective" : f2(r.priority)}</span>
          </div>
          <div className="tabular mt-1 text-[12px] text-ink-3">
            {f2(r.urgency)} × {f2(r.confidence)} × {f2(r.relevance)} − {f2(r.cost)}
          </div>
          <div className={`mt-1 text-[12px] font-semibold ${r.decision === "selected" ? "text-good" : "text-ink-2"}`}>{VERDICT[r.decision] ?? r.decision}</div>
        </li>
      ))}
    </ol>
  );
}
