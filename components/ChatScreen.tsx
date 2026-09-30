"use client";

import { useEffect, useRef, useState } from "react";
import { APP } from "@/config/app";
import { localAsk } from "@/lib/local";
import { STATIC } from "@/lib/runtime";
import type { AnswerCard, AskResponse, FinState, Intent, ProposedAction } from "@/lib/types";
import { eur, eur0, fmtDate, uid } from "@/lib/util";
import { IconAlert, IconCheck, IconClose, IconMic, IconSend, IconSparkle, IconSpeaker, IconSpeakerOff } from "./Icons";
import { MetaLine, humanKey, humanVal } from "./InsightDetail";
import { Button } from "./ui";

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  card?: AnswerCard;
  actions?: ProposedAction[];
  meta?: AskResponse["meta"];
  facts?: Record<string, string | number>;
  intent?: Intent;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function getRecognizer(): any {
  if (typeof window === "undefined") return null;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = "en-GB";
  r.interimResults = false;
  r.maxAlternatives = 1;
  return r;
}

async function speak(text: string, useEleven: boolean) {
  try {
    if (useEleven) {
      const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (r.ok) {
        const url = URL.createObjectURL(await r.blob());
        await new Audio(url).play();
        return;
      }
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-GB";
      u.rate = 1.03;
      window.speechSynthesis.speak(u);
    }
  } catch {
    /* voice is a nice-to-have */
  }
}

export function ChatScreen({
  state,
  messages,
  setMessages,
  onAction,
  onDebug,
  ttsEnabled,
}: {
  state: FinState;
  messages: ChatMsg[];
  setMessages: (fn: (m: ChatMsg[]) => ChatMsg[]) => void;
  onAction: (a: ProposedAction) => void;
  onDebug: (r: AskResponse) => void;
  ttsEnabled: boolean;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setInput("");
    const history = messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));
    const lastIntent = [...messages].reverse().find((m) => m.intent)?.intent;
    setMessages((m) => [...m, { id: uid("m"), role: "user", text: question }]);
    setBusy(true);
    try {
      let j: AskResponse;
      if (STATIC) {
        await new Promise((res) => setTimeout(res, 450)); // feel like a real round trip
        j = localAsk(question, state, lastIntent);
      } else {
        try {
          const r = await fetch("/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, state, history, lastIntent }),
          });
          if (!r.ok) throw new Error(String(r.status));
          j = (await r.json()) as AskResponse;
        } catch {
          j = localAsk(question, state, lastIntent); // server down: engine still answers
        }
      }
      onDebug(j);
      setMessages((m) => [
        ...m,
        { id: uid("m"), role: "assistant", text: j.text, card: j.card, actions: j.actions, meta: j.meta, facts: j.facts, intent: j.intent },
      ]);
      if (speakOn) speak(j.text, ttsEnabled);
    } catch {
      setMessages((m) => [...m, { id: uid("m"), role: "assistant", text: "Sorry, I couldn't reach the server. Try again?" }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const r = getRecognizer();
    if (!r) {
      alert("Voice input needs Chrome or Edge.");
      return;
    }
    recRef.current = r;
    r.onresult = (e: any) => send(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent to-brand text-white">
            <IconSparkle size={18} />
          </div>
          <div>
            <div className="text-[15px] font-semibold leading-tight">{APP.assistantName}</div>
            <div className="text-[11.5px] text-ink-3">Can&apos;t move money without your OK</div>
          </div>
        </div>
        <button
          onClick={() => setSpeakOn(!speakOn)}
          className={`rounded-full p-2 ${speakOn ? "bg-accent-soft text-accent" : "text-ink-3 hover:bg-surface-2"}`}
          aria-label="Read answers aloud"
          title="Read answers aloud"
        >
          {speakOn ? <IconSpeaker size={18} /> : <IconSpeakerOff size={18} />}
        </button>
      </div>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-surface-2 px-4 py-4 no-scrollbar">
        <Bubble role="assistant">
          Hi {state.profile.name}. I can see your balance, bills and spending, and I can do the maths on anything you're planning. What's on your mind?
        </Bubble>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 pl-1">
            {APP.suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-accent/30 bg-surface px-3 py-1.5 text-left text-[12.5px] text-brand hover:bg-accent-soft">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="anim-pop">
            <Bubble role={m.role}>
              {m.text}
              {m.card && <CardView card={m.card} />}
              {m.actions && m.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.actions.map((a) => (
                    <Button key={a.label} size="sm" variant={a.primary ? "primary" : "soft"} onClick={() => onAction(a)}>
                      {a.label}
                    </Button>
                  ))}
                </div>
              )}
              {m.role === "assistant" && m.meta && <MetaLine meta={m.meta} />}
              {m.facts && <FactsPeek facts={m.facts} />}
            </Bubble>
          </div>
        ))}
        {busy && (
          <Bubble role="assistant">
            <span className="inline-flex gap-1 py-1">
              <Dot d={0} />
              <Dot d={150} />
              <Dot d={300} />
            </span>
          </Bubble>
        )}
        {messages.length > 0 && !busy && (
          <div className="flex flex-wrap gap-2 pl-1 pt-1">
            {APP.suggestions
              .filter((s) => !messages.some((m) => m.text === s))
              .slice(0, 2)
              .map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-ink-2 hover:bg-accent-soft">
                  {s}
                </button>
              ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-line bg-surface px-3 py-2.5"
      >
        {!STATIC && (<button
          type="button"
          onClick={toggleMic}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${listening ? "animate-pulse bg-crit text-white" : "bg-surface-2 text-ink-2"}`}
          aria-label="Speak"
        >
          <IconMic size={18} />
        </button>)}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Listening…" : `Ask ${APP.assistantName} anything`}
          className="h-10 min-w-0 flex-1 rounded-full bg-surface-2 px-4 text-[14px] outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button type="submit" disabled={!input.trim() || busy} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40" aria-label="Send">
          <IconSend size={17} />
        </button>
      </form>
    </div>
  );
}

function Dot({ d }: { d: number }) {
  return <span className="h-2 w-2 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${d}ms` }} />;
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  if (role === "user")
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[14px] leading-relaxed text-white">{children}</div>
      </div>
    );
  return (
    <div className="flex">
      <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink shadow-sm">{children}</div>
    </div>
  );
}

function FactsPeek({ facts }: { facts: Record<string, string | number> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button onClick={() => setOpen(!open)} className="text-[11px] font-semibold text-accent">
        {open ? "Hide the maths" : "Show the maths"}
      </button>
      {open && (
        <div className="anim-fade mt-1 divide-y divide-line rounded-lg bg-surface-2 px-2.5 py-1 text-[12px]">
          {Object.entries(facts).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-1">
              <span className="text-ink-2">{humanKey(k)}</span>
              <span className="tabular text-right font-medium">{humanVal(k, v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const VERDICT = {
  comfortable: { label: "Comfortable", cls: "bg-good-soft text-good", Icon: IconCheck },
  tight: { label: "Tight", cls: "bg-warn-soft text-warn", Icon: IconAlert },
  not_yet: { label: "Not yet", cls: "bg-crit-soft text-crit", Icon: IconClose },
};

function CardView({ card }: { card: AnswerCard }) {
  if (card.type === "affordability") {
    const v = VERDICT[card.verdict];
    return (
      <div className="mt-3 rounded-xl border border-line p-3">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-semibold">{card.label[0].toUpperCase() + card.label.slice(1)}</div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.cls}`}>
            <v.Icon size={12} strokeWidth={2.6} /> {v.label}
          </span>
        </div>
        <div className="text-[12px] text-ink-3">
          {eur0(card.amount)} on {fmtDate(card.date)}
        </div>
        <div className="mt-2 divide-y divide-line text-[13px]">
          {card.rows.map((r) => (
            <div key={r.label} className="flex justify-between py-1.5">
              <span className={r.emphasis ? "font-medium" : "text-ink-2"}>{r.label}</span>
              <span className={`tabular whitespace-nowrap pl-3 ${r.emphasis ? "font-bold" : ""} ${r.value < 0 ? "text-crit" : ""}`}>{eur0(r.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (card.type === "breakdown") {
    const max = Math.max(...card.rows.map((r) => r.value), 1);
    return (
      <div className="mt-3 rounded-xl border border-line p-3">
        <div className="mb-2 text-[12px] font-semibold text-ink-3">{card.title}</div>
        <div className="grid gap-2">
          {card.rows.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between text-[12.5px]">
                <span>{r.label}</span>
                <span className="tabular font-semibold">{eur0(r.value)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-surface-2">
                  <div className="h-2 rounded-full bg-accent" style={{ width: `${(r.value / max) * 100}%` }} />
                </div>
                {r.note && <span className="tabular w-[92px] text-right text-[11px] text-ink-3">{r.note}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 divide-y divide-line rounded-xl border border-line px-3 py-1">
      {card.items.map((u) => (
        <div key={u.id} className="flex justify-between py-1.5 text-[13px]">
          <span>
            {u.label} <span className="text-ink-3">· {fmtDate(u.date)}</span>
          </span>
          <span className="tabular font-semibold">{eur(u.amount)}</span>
        </div>
      ))}
    </div>
  );
}
