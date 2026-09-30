// Headless nightly pass: npm run nightly [N]. Prints throughput and the moment mix.
import { generateCustomer } from "../lib/population";
import { decide } from "../lib/orchestrator";

const N = Number(process.argv[2] || 100000);
const t0 = performance.now();
const chosen: Record<string, number> = {};
const held: Record<string, number> = {};
const channels: Record<string, number> = {};
let none = 0;
for (let i = 0; i < N; i++) {
  const d = decide(generateCustomer(i));
  if (d.chosen) {
    chosen[d.chosen.momentId] = (chosen[d.chosen.momentId] || 0) + 1;
    channels[d.chosen.channel] = (channels[d.chosen.channel] || 0) + 1;
  } else none++;
  for (const h of d.held) held[h.reason] = (held[h.reason] || 0) + 1;
}
const ms = performance.now() - t0;
const perCust = ms / N;
console.log(`${N} customers in ${ms.toFixed(0)} ms = ${(perCust * 1000).toFixed(1)} µs/customer`);
console.log(`2.3M on one core ≈ ${((perCust * 2.3e6) / 1000).toFixed(1)} s (generation + detection + decision)`);
console.log({ none, chosen, held, channels });
