import Groq from "groq-sdk";
import { z } from "zod";
import { headerRepairFetch } from "@/lib/identity-fetch";
import type { RawChange } from "./types";

export const CLASSIFIER_MODEL = "openai/gpt-oss-120b";
export const CHANGES_PER_LLM_CALL = 10;

const OutputSchema = z.object({
  changes: z.array(
    z.object({
      index: z.number().int(),
      summary: z.string().min(1),
      impactHint: z.string(),
    }),
  ),
});

export interface BatchSummary {
  summary: string;
  impactHint: string;
}

function capValue(value: unknown, maxChars: number): string {
  try {
    const s = JSON.stringify(value) ?? "null";
    return s.length > maxChars ? s.slice(0, maxChars) : s;
  } catch {
    return String(value).slice(0, maxChars);
  }
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("no JSON object in response");
  }
}

export interface Classifier {
  classifyBatch(
    vendorName: string,
    batch: RawChange[],
    batchOffset: number,
  ): Promise<Map<number, BatchSummary>>;
}

export function createClassifier(apiKey?: string): Classifier {
  const client = new Groq(apiKey ? { apiKey, fetch: headerRepairFetch } : { fetch: headerRepairFetch });

  return {
    async classifyBatch(vendorName, batch, batchOffset) {
      const payload = batch.map((change, i) => ({
        index: batchOffset + i,
        jsonPath: change.jsonPath,
        kind: change.kind,
        severity: change.severity,
        before: change.before ? capValue(change.before, 400) : undefined,
        after: change.after ? capValue(change.after, 400) : undefined,
      }));

      const response = await client.chat.completions.create({
        model: CLASSIFIER_MODEL,
        max_tokens: 2048,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You turn OpenAPI spec diffs into plain-English developer alerts. " +
              "For each numbered change write exactly two fields: " +
              "summary — one present-tense sentence naming the API, endpoint, and field; " +
              "impactHint — one sentence starting with 'If you' telling the developer what breaks or what to check. " +
              "No markdown, no preamble. Respond with only a JSON object: " +
              '{"changes":[{"index":0,"summary":"...","impactHint":"..."}]}',
          },
          {
            role: "user",
            content: `Vendor: ${vendorName}\nNumbered changes:\n${JSON.stringify(payload)}`,
          },
        ],
      });

      if (!response.choices) {
        console.error(
          "[classifier] response without choices:",
          JSON.stringify(response)?.slice(0, 500),
        );
      }
      const text = response.choices?.[0]?.message?.content ?? "";

      const parsed = OutputSchema.parse(extractJson(text));
      const results = new Map<number, BatchSummary>();
      for (const entry of parsed.changes) {
        results.set(entry.index, {
          summary: entry.summary,
          impactHint: entry.impactHint,
        });
      }
      return results;
    },
  };
}

export function fallbackSummaries(
  vendorName: string,
  changes: RawChange[],
): Map<number, BatchSummary> {
  const results = new Map<number, BatchSummary>();
  changes.forEach((change, index) => {
    results.set(index, {
      summary: `${vendorName} changed ${change.jsonPath} (${change.kind}).`,
      impactHint:
        change.severity === "breaking"
          ? "If you use this part of the API, check your integration before your next deploy."
          : "No action required unless you rely on this part of the API.",
    });
  });
  return results;
}
