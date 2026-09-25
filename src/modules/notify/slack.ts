import type { ClassifiedChange, ChangelogEntry } from "@/engine/types";

export async function sendSlack(
  webhookUrl: string,
  vendorName: string,
  changes: ClassifiedChange[],
  entries: ChangelogEntry[],
): Promise<void> {
  if (!webhookUrl) return;
  const emoji: Record<string, string> = {
    breaking: ":rotating_light:",
    deprecation: ":warning:",
    feature: ":sparkles:",
    docs: ":book:",
  };
  const lines = changes
    .slice(0, 12)
    .map(
      (change) =>
        `${emoji[change.severity] ?? ":pushpin:"} *${change.severity.toUpperCase()}* \`${change.jsonPath}\`\n${change.summary ?? change.kind}${change.impactHint ? `\n>${change.impactHint}` : ""}`,
    );
  if (entries.length > 0) {
    lines.push(`:mega: Changelog: ${entries.map((e) => e.title).join(", ").slice(0, 600)}`);
  }
  const text =
    `*SpecWatch — the ${vendorName} API just changed*\n\n${lines.join("\n\n")}`.slice(0, 2800);

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(10_000),
  });
}
