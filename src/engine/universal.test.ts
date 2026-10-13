import { describe, it, expect } from "vitest";
import { detectSourceKind, normalizeSpec } from "./normalizer";
import { diffNormalizedSpecs } from "./differ";
import { candidateSourceUrls, discoverSource, probeBody } from "./probe";

const OPENAPI_V1 = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "Niche Pay", version: "1.0.0" },
  paths: { "/charges": { post: { responses: { "200": { description: "ok" } } } } },
});

const GRAPHQL_SDL_V1 = `
type Query { charge(id: ID!): Charge }
type Charge { id: ID!, amount: Int }
`;
const GRAPHQL_SDL_V2 = `
type Query { charge(id: ID!): Charge }
type Charge { id: String!, currency: String }
`;

const INTROSPECTION = JSON.stringify({
  data: {
    __schema: {
      types: [
        {
          name: "Query",
          kind: "OBJECT",
          fields: [
            { name: "charge", type: { kind: "OBJECT", name: "Charge" }, args: [{ name: "id", type: { kind: "NON_NULL", ofType: { kind: "SCALAR", name: "ID" } } }] },
          ],
        },
        { name: "Charge", kind: "OBJECT", fields: [{ name: "id", type: { kind: "SCALAR", name: "ID" }, args: [] }] },
      ],
    },
  },
});

const ASYNCAPI = `
asyncapi: 3.0.0
info: { title: Events, version: 1.0.0 }
channels:
  payments: { address: payments.created }
`;

const POSTMAN = JSON.stringify({
  info: { name: "Niche API", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  item: [
    {
      name: "Create charge",
      request: { method: "POST", url: { raw: "{{base}}/charges", query: [{ key: "amount" }] } },
    },
  ],
});

const DOCS_V1 = `<html><head><title>Niche Docs</title></head><body>
<h1>Getting started</h1><p>Use your API key.</p>
<h2>Charges</h2><p>Create a charge with POST /charges.</p>
</body></html>`;
const DOCS_V2 = `<html><head><title>Niche Docs</title></head><body>
<h1>Getting started</h1><p>Use your API key.</p>
<h2>Charges</h2><p>Create a charge with POST /charges. Now requires a customer id.</p>
<h2>Refunds</h2><p>New refunds endpoint.</p>
</body></html>`;

const MD_V1 = "# Guide\nIntro text.\n## Auth\nUse a token.\n";
const MD_V2 = "# Guide\nIntro text.\n## Auth\nUse OAuth2 instead.\n";

describe("detectSourceKind", () => {
  it("detects every supported format", () => {
    expect(detectSourceKind(OPENAPI_V1)).toBe("openapi");
    expect(detectSourceKind(GRAPHQL_SDL_V1)).toBe("graphql");
    expect(detectSourceKind(INTROSPECTION)).toBe("graphql");
    expect(detectSourceKind(ASYNCAPI)).toBe("asyncapi");
    expect(detectSourceKind(POSTMAN)).toBe("postman");
    expect(detectSourceKind(DOCS_V1)).toBe("docs");
    expect(detectSourceKind('{"custom": {"schema": 1}}')).toBe("json");
    expect(detectSourceKind(MD_V1)).toBe("text");
  });
});

describe("universal normalize + diff", () => {
  it("OpenAPI still normalizes and self-diffs empty (backwards compat)", async () => {
    const n = await normalizeSpec(OPENAPI_V1);
    expect(n.detectedKind).toBe("openapi");
    expect(diffNormalizedSpecs(n.tree, n.tree)).toEqual([]);
  });

  it("GraphQL SDL: field removed is breaking, type change is breaking, field added is feature", async () => {
    const a = await normalizeSpec(GRAPHQL_SDL_V1);
    const b = await normalizeSpec(GRAPHQL_SDL_V2);
    expect(a.detectedKind).toBe("graphql");
    const changes = diffNormalizedSpecs(a.tree, b.tree);
    expect(changes.some((c) => c.severity === "breaking")).toBe(true);
  });

  it("GraphQL introspection normalizes to a types tree", async () => {
    const n = await normalizeSpec(INTROSPECTION);
    expect(n.detectedKind).toBe("graphql");
    const tree = n.tree as { types: Record<string, unknown> };
    expect(Object.keys(tree.types)).toContain("Charge");
  });

  it("AsyncAPI and Postman normalize and diff", async () => {
    const a = await normalizeSpec(ASYNCAPI);
    expect(a.detectedKind).toBe("asyncapi");
    const p = await normalizeSpec(POSTMAN);
    expect(p.detectedKind).toBe("postman");
    const p2 = await normalizeSpec(POSTMAN.replace("/charges", "/payouts"));
    expect(diffNormalizedSpecs(p.tree, p2.tree).length).toBeGreaterThan(0);
  });

  it("docs HTML: prose edit is docs-severity, new section is detected", async () => {
    const a = await normalizeSpec(DOCS_V1);
    const b = await normalizeSpec(DOCS_V2);
    expect(a.detectedKind).toBe("docs");
    const changes = diffNormalizedSpecs(a.tree, b.tree);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every((c) => c.severity === "docs" || c.severity === "deprecation")).toBe(true);
  });

  it("markdown text: section edit is detected as docs", async () => {
    const a = await normalizeSpec(MD_V1);
    const b = await normalizeSpec(MD_V2);
    expect(a.detectedKind).toBe("text");
    expect(diffNormalizedSpecs(a.tree, b.tree).some((c) => c.kind.startsWith("docs."))).toBe(true);
  });

  it("generic JSON: removed key is breaking, added key is feature", async () => {
    const a = await normalizeSpec('{"endpoints": {"/a": {"method": "GET"}}}');
    const b = await normalizeSpec('{"endpoints": {}}');
    const changes = diffNormalizedSpecs(a.tree, b.tree);
    expect(changes.some((c) => c.severity === "breaking")).toBe(true);
  });
});

describe("probe & discovery", () => {
  it("probeBody verifies a body without network", async () => {
    const r = await probeBody("https://x.example/openapi.json", OPENAPI_V1);
    expect(r.ok).toBe(true);
    expect(r.kind).toBe("openapi");
    expect(r.surfaceCount).toBe(1);
  });

  it("discovers /openapi.json from a homepage", async () => {
    const fetchBody = async (url: string) => {
      if (url.endsWith("/openapi.json")) return OPENAPI_V1;
      if (url === "https://niche.example") return DOCS_V1;
      throw new Error("404");
    };
    const found = await discoverSource("https://niche.example", fetchBody);
    expect(found?.url).toBe("https://niche.example/openapi.json");
    expect(found?.kind).toBe("openapi");
  });

  it("falls back to watching the docs page itself for a docs-only niche API", async () => {
    const fetchBody = async (url: string) => {
      if (url === "https://niche.example/docs") return DOCS_V1;
      throw new Error("404");
    };
    const found = await discoverSource("https://niche.example/docs", fetchBody);
    expect(found?.kind).toBe("docs");
    expect(found?.url).toBe("https://niche.example/docs");
  });

  it("candidate URLs are same-origin well-known paths", () => {
    const urls = candidateSourceUrls("https://api.example.com/docs");
    expect(urls).toContain("https://api.example.com/openapi.json");
    expect(urls.every((u) => u.startsWith("https://api.example.com"))).toBe(true);
  });
});
