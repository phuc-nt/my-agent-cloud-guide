// Regenerate the diagrams from diagrams/src with archify 3.x.
// Usage, from the repository root: node diagrams/build.mjs <archify-skill-dir> [name ...]
// Each spec gets the shared Vietnamese viewer catalog (src/vi.json) as meta.translations.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [archify, ...only] = process.argv.slice(2);
if (!archify) {
  console.error("usage: node diagrams/build.mjs <archify-skill-dir> [name ...]");
  process.exit(2);
}

const src = "diagrams/src";
const vi = JSON.parse(readFileSync(join(src, "vi.json"), "utf8"));
const names = only.length ? only : readdirSync(src)
  .filter((f) => f.endsWith(".json") && f !== "vi.json")
  .map((f) => f.slice(0, -5));

const work = mkdtempSync(join(tmpdir(), "guide-diagrams-"));
let failed = 0;
try {
  for (const name of names) {
    const spec = JSON.parse(readFileSync(join(src, `${name}.json`), "utf8"));
    spec.meta.translations = vi;
    const input = join(work, `${name}.json`);
    writeFileSync(input, JSON.stringify(spec));
    const args = [join(archify, "bin/archify.mjs"), "finalize", spec.diagram_type, input, spec.meta.output,
      "--quality", "showcase", "--browser-check", "--out-dir", join(work, "receipts"), "--json"];
    try {
      const receipt = JSON.parse(execFileSync("node", args, { stdio: ["ignore", "pipe", "pipe"] }));
      const gates = Object.entries(receipt.gates).map(([g, s]) => `${g} ${s}`).join(", ");
      console.log(`ok    ${name}: ${gates}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${name}\n${e.stdout || ""}${e.stderr || ""}`);
    }
    // The delivery receipt lands beside the HTML and records local paths; it is not published.
    rmSync(join("diagrams", `${name}.delivery.json`), { force: true });
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
