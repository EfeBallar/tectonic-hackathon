"use client";

import { useEffect, useMemo, useState } from "react";
import { APP } from "@/config/app";
import { ActionConfirmation } from "@/components/ActionConfirmation";
import { ActivityScreen } from "@/components/ActivityScreen";
import { ChatScreen, type ChatMsg } from "@/components/ChatScreen";
import { DemoPanel } from "@/components/DemoPanel";
import { HomeScreen } from "@/components/HomeScreen";
import { IconActivity, IconChat, IconHome } from "@/components/Icons";
import { InsightDetail } from "@/components/InsightDetail";
import { TransactionList } from "@/components/TransactionList";
import { Sheet } from "@/components/ui";
import { applyAction, needsConfirmation } from "@/lib/actions";
import { STATIC } from "@/lib/runtime";
import { analyze } from "@/lib/engine";
import { applyScenario, buildPersona, type ScenarioId } from "@/lib/personas";
import type { AskResponse, Category, FinState, Insight, ProposedAction } from "@/lib/types";
import { CATEGORY_LABEL, eur, eur0, todayISO } from "@/lib/util";

type Tab = "home" | "kate" | "activity";
type SheetState =
  | { type: "insight"; id: string }
  | { type: "tx"; category?: Category; merchants?: string[] }
  | { type: "safe" }
  | null;

export default function Page() {
  const [personaId, setPersonaId] = useState("lotte");
  const [fin, setFin] = useState<FinState | null>(null);
  const [undo, setUndo] = useState<FinState[]>([]);
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [confirm, setConfirm] = useState<{ action: ProposedAction; origin: string; insightId?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [lastAsk, setLastAsk] = useState<AskResponse | null>(null);
  const [status, setStatus] = useState<{ provider: string; model: string; tts?: boolean } | null>(null);
  const [clock, setClock] = useState("");

  useEffect(() => {
    setFin(buildPersona(personaId, todayISO()));
    setUndo([]);
    setMessages([]);
    setSheet(null);
    setConfirm(null);
    setLastAsk(null);
    setTab("home");
  }, [personaId]);

  useEffect(() => {
    if (STATIC) setStatus({ provider: "static", model: "templates" });
    else
      fetch("/api/status")
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => setStatus({ provider: "none", model: "templates" }));
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const analysis = useMemo(() => (fin ? analyze(fin) : null), [fin]);

  if (!fin || !analysis) return <div className="grid min-h-screen place-items-center text-ink-3">Loading…</div>;

  const openInsight = sheet?.type === "insight" ? analysis.insights.find((i) => i.id === sheet.id) : undefined;

  function handleAction(a: ProposedAction, origin: string, insightId?: string) {
    if (a.type === "SHOW_TRANSACTIONS") {
      setSheet({
        type: "tx",
        category: a.params.category as Category | undefined,
        merchants: a.params.merchants as string[] | undefined,
      });
      return;
    }
    if (needsConfirmation(a)) {
      setConfirm({ action: a, origin, insightId });
      return;
    }
    commit(a, origin, insightId);
  }

  function commit(a: ProposedAction, origin: string, insightId?: string) {
    if (!fin) return;
    const next = applyAction(fin, a, origin, insightId);
    setUndo((u) => [...u.slice(-9), fin]);
    setFin(next);
    setConfirm(null);
    if (sheet?.type === "insight") setSheet(null);
    setToast(
      a.type === "DISMISS"
        ? `Got it. ${APP.assistantName} will stay quiet about this.`
        : a.type === "MARK_AS_MINE"
          ? "Thanks, marked as yours."
          : next.activity[0]
            ? `Done · ${next.activity[0].title}`
            : "Done",
    );
  }

  function scenario(id: ScenarioId) {
    if (!fin) return;
    setFin(applyScenario(fin, id));
    setTab("home");
    setSheet(null);
  }

  const txFiltered =
    sheet?.type === "tx"
      ? fin.transactions.filter((t) =>
          sheet.category ? t.category === sheet.category : sheet.merchants ? sheet.merchants.includes(t.merchant) : true,
        )
      : [];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-0 sm:p-4 lg:flex-row lg:items-center">
      {/* ---------------- phone ---------------- */}
      <div className="phone relative flex shrink-0 flex-col overflow-hidden bg-surface">
        <div className="flex h-9 shrink-0 items-center justify-between bg-brand px-6 text-[12px] font-semibold text-white">
          <span className="tabular">{clock}</span>
          <span className="tracking-widest">●●●● 5G ▮</span>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto bg-page no-scrollbar">
          {tab === "home" && (
            <HomeScreen
              state={fin}
              analysis={analysis}
              onOpenInsight={(i: Insight) => setSheet({ type: "insight", id: i.id })}
              onAction={(a, i) => handleAction(a, i ? `Insight: ${i.title}` : "Home", i?.id)}
              onOpenSafe={() => setSheet({ type: "safe" })}
              onOpenTx={(f) => setSheet({ type: "tx", ...f })}
              onAsk={() => setTab("kate")}
            />
          )}
          {tab === "kate" && (
            <div className="absolute inset-0">
              <ChatScreen
                state={fin}
                messages={messages}
                setMessages={setMessages}
                onAction={(a) => handleAction(a, `Chat with ${APP.assistantName}`)}
                onDebug={setLastAsk}
                ttsEnabled={!!status?.tts}
              />
            </div>
          )}
          {tab === "activity" && (
            <ActivityScreen
              state={fin}
              onAction={(a) => handleAction(a, "Activity")}
              canUndo={undo.length > 0}
              onUndo={() => {
                const prev = undo[undo.length - 1];
                if (!prev) return;
                setFin(prev);
                setUndo((u) => u.slice(0, -1));
                setToast("Undone");
              }}
            />
          )}
        </div>

        {/* tab bar */}
        <nav className="grid shrink-0 grid-cols-3 border-t border-line bg-surface pb-2 pt-1.5">
          {(
            [
              ["home", "Home", IconHome],
              ["kate", APP.assistantName, IconChat],
              ["activity", "Activity", IconActivity],
            ] as const
          ).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`relative flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold ${tab === id ? "text-accent" : "text-ink-3"}`}>
              <Icon size={21} />
              {label}
              {id === "activity" && fin.activity.length > 0 && <span className="absolute right-[34%] top-0.5 h-2 w-2 rounded-full bg-good" />}
            </button>
          ))}
        </nav>

        {/* overlays */}
        {openInsight && (
          <InsightDetail
            insight={openInsight}
            state={fin}
            onClose={() => setSheet(null)}
            onAction={(a) => handleAction(a, `Insight: ${openInsight.title}`, openInsight.id)}
          />
        )}
        {sheet?.type === "tx" && (
          <Sheet
            onClose={() => setSheet(null)}
            title={sheet.category ? CATEGORY_LABEL[sheet.category] : sheet.merchants ? sheet.merchants.join(", ") : "All payments"}
          >
            <TransactionList txs={txFiltered} flagged={fin.reportedTx} />
          </Sheet>
        )}
        {sheet?.type === "safe" && (
          <Sheet onClose={() => setSheet(null)} title="How safe-to-spend works">
            <p className="text-[13.5px] leading-relaxed text-ink-2">
              Calculated by code from your real balance and history, never guessed by AI. Your lowest projected point before payday, minus the buffer you chose.
            </p>
            <div className="mt-4 divide-y divide-line rounded-2xl border border-line px-4 text-[14px]">
              {analysis.safeToSpendBreakdown.map((r) => (
                <div key={r.label} className="flex justify-between gap-3 py-2.5">
                  <span className="text-ink-2">{r.label}</span>
                  <span className="tabular font-medium">{eur(r.amount, { sign: r.amount > 0 && r.label !== analysis.safeToSpendBreakdown[0].label })}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 font-bold">
                <span>Safe to spend</span>
                <span className="tabular">{eur0(analysis.safeToSpend)}</span>
              </div>
            </div>
            {analysis.lowest.balance < fin.profile.bufferTarget && (
              <p className="mt-3 text-[12.5px] text-warn">
                You&apos;re {eur0(fin.profile.bufferTarget - analysis.lowest.balance)} short of your buffer, so safe-to-spend is {eur0(0)}.
              </p>
            )}
          </Sheet>
        )}
        {confirm && (
          <ActionConfirmation
            action={confirm.action}
            state={fin}
            onCancel={() => setConfirm(null)}
            onConfirm={() => commit(confirm.action, confirm.origin, confirm.insightId)}
          />
        )}
        {toast && (
          <div className="anim-pop absolute inset-x-4 bottom-20 z-50 rounded-2xl bg-ink px-4 py-3 text-center text-[13.5px] font-medium text-white shadow-xl">{toast}</div>
        )}
      </div>

      {/* ---------------- presenter panel ---------------- */}
      <div className="w-full px-4 pb-10 sm:px-0 lg:w-auto lg:pb-0">
        <DemoPanel
          personaId={personaId}
          onPersona={setPersonaId}
          onScenario={scenario}
          onReset={() => {
            setFin(buildPersona(personaId, todayISO()));
            setUndo([]);
            setMessages([]);
            setLastAsk(null);
            setSheet(null);
          }}
          analysis={analysis}
          lastAsk={lastAsk}
          status={status}
        />
      </div>
    </main>
  );
}
