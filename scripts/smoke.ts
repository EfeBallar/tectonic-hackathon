import { buildPersona, applyScenario } from "../lib/personas";
import { analyze } from "../lib/engine";
import { parseIntentRegex, runTool } from "../lib/tools";
import { todayISO } from "../lib/util";

const today = process.argv[2] || todayISO();
for (const id of ["lotte", "bram", "noah"]) {
  const s = buildPersona(id, today);
  const a = analyze(s);
  console.log(`\n=== ${id} | checking ${s.checking} savings ${s.savings} | payday ${a.nextPayday} (${a.daysToPayday}d) | daily ${a.dailyDiscretionary} | lowest ${a.lowest.balance} on ${a.lowest.date} | safe ${a.safeToSpend}`);
  console.log("upcoming:", a.upcoming.map(u => `${u.date} ${u.label} ${u.amount} (${u.source})`).join(" | "));
  console.log("recurring:", a.recurring.map(r => `${r.merchant} ${r.prevAmount}->${r.lastAmount} next ${r.nextDate}`).join(" | "));
  for (const i of a.insights) console.log(` [${i.severity}] ${i.title}\n     ${i.summary}\n     actions: ${i.actions.map(x => x.label).join(" / ")}`);
  const s2 = applyScenario(s, "suspicious");
  console.log(" +suspicious ->", analyze(s2).insights.map(i => i.id).join(", "));
}
const s = buildPersona("lotte", today);
for (const q of ["Can I afford a €650 trip to Barcelona this weekend?", "Can I afford a €650 trip to Barcelona next month?", "why did I spend more this month?", "what's coming up before payday?", "move 200 to savings", "can i buy a 1200 euro laptop in december", "hey"]) {
  const intent = parseIntentRegex(q, today);
  const r = runTool(s, intent);
  console.log(`\nQ: ${q}\n intent: ${JSON.stringify(intent)}\n A: ${r.templateText}\n actions: ${r.actions.map(a => a.label).join(" / ")}`);
}
