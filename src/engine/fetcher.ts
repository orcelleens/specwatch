import type { FetchedSpec } from "./types";

export const MAX_SPEC_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

export interface FetchOptions {
  etag?: string | null;
  lastModified?: string | null;
}

export class SpecTooLargeError extends Error {
  constructor(public sizeBytes: number) {
    super(`spec exceeds ${MAX_SPEC_BYTES} bytes (${sizeBytes})`);
  }
}

export async function fetchSpec(
  url: string,
  opts: FetchOptions = {},
): Promise<FetchedSpec> {
  const headers: Record<string, string> = {
    "user-agent": "SpecWatch/0.1 (+https://specwatch.dev)",
  };
  if (opts.etag) headers["if-none-match"] = opts.etag;
  if (opts.lastModified) headers["if-modified-since"] = opts.lastModified;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

  if (res.status === 304) {
    return { raw: "", changed: false, etag: opts.etag ?? undefined, sizeBytes: 0 };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  const lengthHeader = res.headers.get("content-length");
  if (lengthHeader && parseInt(lengthHeader, 10) > MAX_SPEC_BYTES) {
    throw new SpecTooLargeError(parseInt(lengthHeader, 10));
  }

  const raw = await res.text();
  if (raw.length > MAX_SPEC_BYTES) {
    throw new SpecTooLargeError(raw.length);
  }

  return {
    raw,
    changed: true,
    etag: res.headers.get("etag") ?? undefined,
    lastModified: res.headers.get("last-modified") ?? undefined,
    sizeBytes: Buffer.byteLength(raw, "utf8"),
  };
}
