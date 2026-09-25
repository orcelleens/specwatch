import { readFileSync } from "node:fs";
import { createClassifier } from "../src/engine/classifier";
import type { RawChange } from "../src/engine/types";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const key = env.match(/^GROQ_API_KEY=(.+)$/m)?.[1];
if (!key) throw new Error("GROQ_API_KEY missing in .env.local");

const c = createClassifier(key);
const batch: RawChange[] = [
  {
    jsonPath: "paths./v1/charges.get.responses.200.schema.properties.id",
    kind: "removed",
    severity: "breaking",
    before: { type: "string", description: "Charge ID" },
    after: undefined,
  },
  {
    jsonPath:
      "paths./v1/refunds.post.requestBody.content.application/json.schema.properties.reason",
    kind: "added",
    severity: "feature",
    before: undefined,
    after: { type: "string", enum: ["duplicate", "fraudulent"] },
  },
];

async function main() {
  const result = await c.classifyBatch("Stripe", batch, 0);
  for (const [i, s] of [...result.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`#${i} [${s.summary}]`);
    console.log(`   ${s.impactHint}`);
  }
}

void main();
