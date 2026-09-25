import { Resend } from "resend";
import type { ClassifiedChange, ChangelogEntry, Severity } from "@/engine/types";

const SEVERITY_STYLES: Record<Severity, { label: string; bg: string; color: string }> = {
  breaking: { label: "BREAKING", bg: "#7f1d1d", color: "#fca5a5" },
  deprecation: { label: "DEPRECATION", bg: "#78350f", color: "#fcd34d" },
  feature: { label: "NEW", bg: "#14532d", color: "#86efac" },
  docs: { label: "DOCS", bg: "#27272a", color: "#a1a1aa" },
};

// built via concatenation so the entities cannot be mangled by tooling
function esc(value: string): string {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

function shell(inner: string, preheader: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#09090b;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden;font-family:ui-sans-serif,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr><td style="padding:20px 28px;background:#0c0c0e;border-bottom:1px solid #27272a;">
    <span style="font-size:18px;font-weight:700;color:#fafafa;">Spec<span style="color:#f97316;">Watch</span></span>
  </td></tr>
  ${inner}
  <tr><td style="padding:18px 28px;border-top:1px solid #27272a;color:#71717a;font-size:12px;">
    You get this email because you watch this API on
    <a href="https://specwatch.dev" style="color:#a1a1aa;">SpecWatch</a>.
    <a href="https://specwatch.dev/dashboard/settings" style="color:#a1a1aa;">Manage alerts</a>.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function changeRow(change: ClassifiedChange): string {
  const style = SEVERITY_STYLES[change.severity];
  return `
  <tr><td style="padding:16px 28px;border-bottom:1px solid #27272a;">
    <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.06em;background:${style.bg};color:${style.color};border-radius:4px;padding:3px 8px;">${style.label}</span>
    <span style="display:inline-block;margin-left:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#a1a1aa;">${esc(change.jsonPath)}</span>
    <p style="margin:10px 0 6px;font-size:15px;line-height:1.5;color:#e4e4e7;">${esc(change.summary ?? `${change.kind}`)}</p>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#a1a1aa;">${esc(change.impactHint ?? "")}</p>
  </td></tr>`;
}

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  // The Resend SDK resolves with { error } instead of throwing on API
  // failures; rethrow so callers' catch blocks actually fire.
  const { error } = await resend.emails.send({
    from: process.env.ALERT_FROM_EMAIL ?? "SpecWatch <onboarding@resend.dev>",
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) throw new Error(`Resend send to ${params.to} failed: ${error.message}`);
}

export function alertEmail(params: {
  vendorName: string;
  changes: ClassifiedChange[];
  entries: ChangelogEntry[];
  permalinkBase: string;
}): { subject: string; html: string } {
  const breakingCount = params.changes.filter((c) => c.severity === "breaking").length;
  const subject = breakingCount
    ? `[SpecWatch] ${breakingCount} breaking ${breakingCount === 1 ? "change" : "changes"} detected in the ${params.vendorName} API`
    : `[SpecWatch] ${params.vendorName} API changes detected`;

  const rows =
    params.changes.map(changeRow).join("") +
    (params.entries.length > 0
      ? `<tr><td style="padding:16px 28px;border-bottom:1px solid #27272a;">
          <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.06em;background:#1e3a5f;color:#93c5fd;border-radius:4px;padding:3px 8px;">CHANGELOG</span>
          ${params.entries
            .map(
              (entry) =>
                `<p style="margin:10px 0 2px;font-size:14px;color:#e4e4e7;">${entry.url ? `<a href="${esc(entry.url)}" style="color:#93c5fd;">${esc(entry.title)}</a>` : esc(entry.title)}</p>`,
            )
            .join("")}
        </td></tr>`
      : "");

  return {
    subject,
    html: shell(
      `<tr><td style="padding:24px 28px 8px;">
        <h1 style="margin:0 0 4px;font-size:20px;color:#fafafa;">The ${esc(params.vendorName)} API just changed</h1>
        <p style="margin:0;font-size:13px;color:#a1a1aa;">Caught by SpecWatch a few minutes after the spec changed.</p>
      </td></tr>${rows}`,
      `${params.vendorName} API changes caught by SpecWatch`,
    ),
  };
}

export function digestEmail(params: {
  groups: { vendorName: string; changes: ClassifiedChange[]; entries: ChangelogEntry[] }[];
}): { subject: string; html: string } {
  const totalChanges = params.groups.reduce((sum, g) => sum + g.changes.length, 0);
  const rows = params.groups
    .map(
      (group) => `
      <tr><td style="padding:18px 28px 6px;font-size:14px;font-weight:700;color:#fafafa;border-bottom:1px solid #27272a;">${esc(group.vendorName)}</td></tr>
      ${group.changes.map(changeRow).join("")}
      ${
        group.entries.length
          ? `<tr><td style="padding:12px 28px 16px;font-size:13px;color:#a1a1aa;">Changelog: ${group.entries
              .map((e) => (e.url ? `<a href="${esc(e.url)}" style="color:#93c5fd;">${esc(e.title)}</a>` : esc(e.title)))
              .join(" · ")}</td></tr>`
          : ""
      }`,
    )
    .join("");

  return {
    subject: `[SpecWatch] Your weekly API watch: ${totalChanges} ${totalChanges === 1 ? "change" : "changes"} across ${params.groups.length} ${params.groups.length === 1 ? "API" : "APIs"}`,
    html: shell(
      `<tr><td style="padding:24px 28px 8px;">
        <h1 style="margin:0 0 4px;font-size:20px;color:#fafafa;">Your week in API changes</h1>
        <p style="margin:0;font-size:13px;color:#a1a1aa;">Everything SpecWatch caught on your watched APIs this week.</p>
      </td></tr>${rows}`,
      `Your weekly SpecWatch digest: ${totalChanges} changes`,
    ),
  };
}
