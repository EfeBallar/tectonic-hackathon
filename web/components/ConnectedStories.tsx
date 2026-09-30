"use client";

import { useEffect, useRef, useState } from "react";
import { HEROES } from "@/lib/heroes";
import { decide } from "@/lib/orchestrator";
import { experience, type Snapshot } from "@/lib/experience";
import { kate, startVoice, type Conversation } from "@/lib/kate";
import { MomentPhone } from "./MomentPhone";
import { AttentionRace } from "./AttentionRace";

export function ConnectedStories() {
  const [heroId, setHeroId] = useState(-1);
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [contact, setContact] = useState("");
  const [consented, setConsented] = useState(false);
  const generation = useRef(0);
  const voice = useRef<Conversation | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const hero = HEROES.find(h => h.id === heroId)!;
  const customer = snapshot?.customer ?? hero.customer;
  const decision = snapshot?.decision ?? decide(customer);

  function stopMedia() {
    if (audio.current) { audio.current.pause(); URL.revokeObjectURL(audio.current.src); audio.current = null; }
    const active = voice.current; voice.current = null;
    void active?.endSession().catch(() => {});
  }
  useEffect(() => () => { generation.current++; stopMedia(); }, []);
  function disconnect(id = heroId) {
    generation.current++; stopMedia(); setHeroId(id); setToken(null); setSnapshot(null);
    setVoiceStatus(""); setTranscript([]); setError(""); setBusy(""); setContact(""); setConsented(false);
  }
  async function run(label: string, work: (g: number) => Promise<void>) {
    if (busy) return;
    const g = generation.current;
    setBusy(label); setError("");
    try { await work(g); }
    catch (e) { if (g === generation.current) setError(e instanceof Error ? e.message : "Request failed. Please try again."); }
    finally { if (g === generation.current) setBusy(""); }
  }
  async function show(t: string, s: Snapshot, g: number) {
    const id = s.decision.chosen?.momentId;
    if (id && !s.customer.presented?.includes(id)) s = await experience.act(t, s.revision, { kind: "present", momentId: id });
    if (g !== generation.current) return;
    setSnapshot(s); setContact(s.customer.trustedContact?.name ?? "");
    setConsented(s.customer.trustedContact?.consented ?? false);
  }
  const connect = () => run("Opening your account…", async g => {
    const login = await kate.login(code, `H00${-heroId}`);
    const state = await experience.current(login.token);
    if (g !== generation.current) return;
    setToken(login.token); await show(login.token, state, g);
  });
  const listen = () => run("Preparing your explanation…", async g => {
    if (!token) return;
    stopMedia();
    const prepared = await experience.prepare(token);
    const url = await kate.audioUrl(token, prepared.nudge_id);
    if (g !== generation.current) { URL.revokeObjectURL(url); return; }
    const player = new Audio(url); audio.current = player;
    player.onended = () => { URL.revokeObjectURL(url); if (audio.current === player) audio.current = null; };
    setVoiceStatus(prepared.composer.startsWith("gemini:") ? "Gemini explanation, read by ElevenLabs" : "Approved wording, read by ElevenLabs");
    await player.play();
  });
  const talk = () => run("Connecting to Kate…", async g => {
    if (!token) return;
    stopMedia();
    const prepared = await experience.prepare(token);
    const credentials = await kate.voiceSession(token, prepared.nudge_id);
    const conversation = await startVoice(credentials, {
      status: s => { if (g === generation.current) setVoiceStatus(s); },
      message: (who, text) => { if (g === generation.current) setTranscript(old => [...old.slice(-7), `${who === "kate" ? "Kate" : "You"}: ${text}`]); },
    });
    if (g !== generation.current) await conversation.endSession();
    else voice.current = conversation;
  });
  const voiceControls = token && decision.chosen ? <div className="mt-3 rounded-xl bg-surface-2 p-3">
    <div className="text-[13px] font-semibold">Talk it through with Kate</div>
    <p className="mt-1 text-[12px] text-ink-2">She starts with this moment and your account context.</p>
    <div className="mt-2 flex gap-2">
      <button disabled={!!busy} onClick={() => void listen()} className="h-9 flex-1 rounded-full bg-white text-[13px] font-semibold text-accent disabled:opacity-50">Listen</button>
      <button disabled={!!busy} onClick={() => void talk()} className="h-9 flex-1 rounded-full bg-accent text-[13px] font-semibold text-white disabled:opacity-50">Talk to Kate</button>
      <button onClick={() => { stopMedia(); setVoiceStatus("Call ended"); }} className="text-[12px] text-ink-2">End</button>
    </div>
    {voiceStatus && <p role="status" className="mt-2 text-[11px] text-ink-3">{voiceStatus}</p>}
  </div> : undefined;

  return <main id="main" className="mx-auto grid max-w-[1200px] items-start gap-8 px-5 pb-10 pt-5 lg:grid-cols-[minmax(0,0.9fr)_390px_minmax(0,1.1fr)] lg:px-10">
    <section className="order-2 lg:order-1" aria-label="Customer stories">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">A little help.<br />At the right moment.</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink-2">Different lives. Different needs. One useful message, when it matters.</p>
      <ul className="mt-5 space-y-1">{HEROES.map(h => <li key={h.id}><button disabled={!!busy} onClick={() => disconnect(h.id)} className={`w-full rounded-lg px-3 py-2.5 text-left disabled:opacity-50 ${heroId === h.id ? "bg-brand text-white" : "hover:bg-white"}`}>
        <span className="block text-[15px] font-bold">{h.customer.name}, {h.customer.age}</span>
        <span className={`block text-[13px] leading-snug ${heroId === h.id ? "text-white/75" : "text-ink-2"}`}>{h.story}</span>
      </button></li>)}</ul>
      {!token ? <form onSubmit={e => { e.preventDefault(); void connect(); }} className="mt-5 rounded-xl bg-white p-4">
        <label htmlFor="access-code" className="text-[14px] font-semibold">Open this demo account</label>
        <p className="mt-1 text-[12px] text-ink-2">Connect to save actions and speak with Kate.</p>
        <input id="access-code" type="password" autoComplete="off" required value={code} onChange={e => setCode(e.target.value)} placeholder="Team demo access code" className="mt-3 h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-[14px]" />
        <button disabled={!!busy} className="mt-3 h-10 w-full rounded-full bg-accent text-[14px] font-semibold text-white disabled:opacity-50">{busy || "Connect account"}</button>
      </form> : <div className="mt-4 text-[13px] text-ink-2"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-good" />Account connected. Actions saved.<button onClick={() => disconnect()} className="ml-2 font-semibold text-accent">Sign out</button></div>}
      {error && <div role="alert" className="mt-3 rounded-lg bg-bad-soft p-3 text-[13px] text-bad">{error}{token && <button className="ml-2 underline" onClick={() => void run("Refreshing…", async g => show(token, await experience.current(token), g))}>Refresh account</button>}</div>}
      {busy && token && <p role="status" className="mt-3 text-[13px] text-ink-2">{busy}</p>}
    </section>
    <div className="order-1 flex flex-col items-center gap-3 lg:order-2">
      <fieldset disabled={!token || !!busy} className="min-w-0 border-0 p-0">
        <MomentPhone key={heroId} customer={customer} decision={decision} voice={voiceControls}
          onPreflight={token ? async () => { const s = await experience.preflight(token); setSnapshot(s); } : undefined}
          onConsent={consent => { if (token && snapshot) void run("Saving your preferences…", async g => show(token, await experience.consent(token, snapshot.revision, consent), g)); }}
          onAct={action => { if (token && snapshot) void run("Saving…", async g => { stopMedia(); await show(token, await experience.act(token, snapshot.revision, action), g); }); }} />
      </fieldset>
      <p className="text-center text-[12px] text-ink-3">{token ? "Synthetic account. No real money moves." : "Preview. Connect the account to interact."}</p>
    </div>
    <section className="order-3" aria-label="Why this moment">
      <AttentionRace decision={decision} name={customer.name.split(" ")[0]} />
      {token && snapshot && <details className="mt-6 rounded-xl bg-white p-4"><summary className="cursor-pointer text-[14px] font-semibold">Someone you trust</summary>
        <p className="mt-2 text-[13px] text-ink-2">Choose who could support you. This prototype saves your choice; it does not send them messages.</p>
        <label className="mt-3 block text-[12px] text-ink-2">Name<input value={contact} maxLength={80} onChange={e => setContact(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-line px-2 text-[14px]" /></label>
        <label className="mt-3 flex gap-2 text-[12px]"><input type="checkbox" checked={consented} onChange={e => setConsented(e.target.checked)} />I agree to add this person as my trusted contact.</label>
        <button disabled={!!busy || (consented && !contact.trim())} onClick={() => void run("Saving…", async g => show(token, await experience.contact(token, snapshot.revision, contact, consented), g))} className="mt-3 text-[13px] font-semibold text-accent disabled:opacity-50">{consented ? "Save my choice" : "Remove consent"}</button>
      </details>}
      {transcript.length > 0 && <div aria-live="polite" className="mt-5 space-y-2 rounded-xl bg-white p-4 text-[13px] text-ink-2">{transcript.map((line, i) => <p key={i}>{line}</p>)}</div>}
    </section>
  </main>;
}
