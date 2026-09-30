// PM acceptance check: each hero gets exactly the right card (none for the new parent).
import { HEROES } from "../lib/heroes";
import { decide } from "../lib/orchestrator";
import { MOMENT_BY_ID } from "../lib/moments";

const expected: Record<number, string | null> = { [-1]: "scam_in_progress", [-2]: "cash_crunch", [-3]: "idle_cash", [-4]: "duplicate_bill", [-5]: null };
let ok = true;
for (const h of HEROES) {
  const d = decide(h.customer);
  const got = d.chosen?.momentId ?? null;
  const pass = got === expected[h.id];
  ok &&= pass;
  console.log(`${pass ? "PASS" : "FAIL"} ${h.emoji} ${h.label}: ${got ? MOMENT_BY_ID[got].action(h.customer).title : "no card"} ${d.chosen ? `(${d.chosen.channel})` : ""}`);
  for (const x of d.held) console.log(`     held ${x.momentId}: ${x.text}`);
}
process.exit(ok ? 0 : 1);
