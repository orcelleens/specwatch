/**
 * Sanitize text for safe PostgreSQL storage.
 * Postgres text rejects NUL and most C0 control bytes (error 22P05).
 * Error messages can carry raw binary (e.g. an undecoded gzip body),
 * which would crash the very write that records the failure.
 */
export function sanitizeText(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  let out = "";
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    // keep tab (9), LF (10), CR (13); drop other C0 controls incl. NUL
    if (cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) continue;
    out += ch;
  }
  return out;
}