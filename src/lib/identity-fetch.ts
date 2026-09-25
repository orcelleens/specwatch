// Next's patched server fetch hands SDK code gateway responses that are
// still transport-compressed (gzip from PostgREST, brotli from Supabase
// storage) with no usable content-encoding header, so SDKs read binary
// garbage — and mojibake with NUL bytes reaches Postgres text columns and
// fails inserts with 22P05. Servers only compress when the client advertises
// support, so ask for identity and pass responses through untouched.
// Pass-through matters: snapshot downloads are gzip blobs by design, and
// re-wrapping responses breaks 204s (204 must not carry a body).
export const identityFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("accept-encoding", "identity");
  return fetch(input, { ...init, headers });
};

// Next's patched fetch also strips ALL response headers, so OpenAI-style SDKs
// (groq-sdk) never see content-type: application/json and return an
// unparseable response (response.choices is undefined). identity + repair the
// content-type by sniffing the body. Bodyless statuses must stay bodyless.
export const headerRepairFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("accept-encoding", "identity");
  const res = await fetch(input, { ...init, headers });
  if (res.status === 204 || res.status === 205 || res.status === 304) {
    return new Response(null, { status: res.status, headers: res.headers });
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const outHeaders = new Headers(res.headers);
  if (!outHeaders.has("content-type")) {
    const head = buf.subarray(0, 1).toString("utf8");
    if (head === "{" || head === "[") outHeaders.set("content-type", "application/json");
    else if (head === "<") outHeaders.set("content-type", "text/html");
    else outHeaders.set("content-type", "text/plain");
  }
  return new Response(buf, { status: res.status, headers: outHeaders });
};
