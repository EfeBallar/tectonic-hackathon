import { buildSync } from "esbuild";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const out = "../kate/assets/experience-engine.cjs";
buildSync({ entryPoints: ["scripts/experience-engine.ts"], outfile: out, bundle: true, platform: "node", target: "node18", format: "cjs" });
const result = spawnSync(process.execPath, [out], { input: JSON.stringify({ op: "heroes" }), encoding: "utf8" });
if (result.status !== 0) throw new Error(result.stderr);
writeFileSync("../kate/assets/heroes.json", result.stdout);
