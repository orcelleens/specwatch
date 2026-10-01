import { describe, it, expect } from "vitest";
import { diffNormalizedSpecs, coalesce, classifyTreeDiff, walkTree } from "./index";
import type { TreeDiff, RawChange, Severity } from "../types";

describe("walkTree", () => {
  it("detects added keys", () => {
    const out: TreeDiff[] = [];
    walkTree({ a: 1 }, { a: 1, b: 2 }, [], out);
    expect(out).toEqual([{ path: ["b"], op: "added", after: 2 }]);
  });

  it("detects removed keys", () => {
    const out: TreeDiff[] = [];
    walkTree({ a: 1, b: 2 }, { a: 1 }, [], out);
    expect(out).toEqual([{ path: ["b"], op: "removed", before: 2 }]);
  });

  it("detects changed values", () => {
    const out: TreeDiff[] = [];
    walkTree({ a: 1 }, { a: 2 }, [], out);
    expect(out).toEqual([{ path: ["a"], op: "changed", before: 1, after: 2 }]);
  });

  it("detects nested changes", () => {
    const out: TreeDiff[] = [];
    walkTree({ a: { b: 1 } }, { a: { b: 2 } }, [], out);
    expect(out).toEqual([{ path: ["a", "b"], op: "changed", before: 1, after: 2 }]);
  });

  it("detects array changes by index", () => {
    const out: TreeDiff[] = [];
    walkTree({ items: [1, 2] }, { items: [1, 3] }, [], out);
    expect(out).toEqual([{ path: ["items", "1"], op: "changed", before: 2, after: 3 }]);
  });

  it("detects array additions", () => {
    const out: TreeDiff[] = [];
    walkTree({ items: [1] }, { items: [1, 2] }, [], out);
    expect(out).toEqual([{ path: ["items", "1"], op: "added", after: 2 }]);
  });

  it("detects array removals", () => {
    const out: TreeDiff[] = [];
    walkTree({ items: [1, 2] }, { items: [1] }, [], out);
    expect(out).toEqual([{ path: ["items", "1"], op: "removed", before: 2 }]);
  });

  it("ignores equal objects", () => {
    const out: TreeDiff[] = [];
    walkTree({ a: { b: 1 } }, { a: { b: 1 } }, [], out);
    expect(out).toEqual([]);
  });
});

describe("classifyTreeDiff", () => {
  it("classifies removed endpoint as breaking", () => {
    const diff: TreeDiff = { path: ["paths", "/v1/charges", "post"], op: "removed" };
    const result = classifyTreeDiff(diff);
    expect(result.severity).toBe("breaking");
    expect(result.kind).toBe("endpoint.removed");
  });

  it("classifies added endpoint as feature", () => {
    const diff: TreeDiff = { path: ["paths", "/v1/refunds", "post"], op: "added" };
    const result = classifyTreeDiff(diff);
    expect(result.severity).toBe("feature");
    expect(result.kind).toBe("endpoint.added");
  });

  it("classifies type change as breaking", () => {
    const diff: TreeDiff = { path: ["paths", "/v1/charges", "post", "parameters", "0", "schema", "type"], op: "changed", before: "string", after: "integer" };
    const result = classifyTreeDiff(diff);
    expect(result.severity).toBe("breaking");
    expect(result.kind).toBe("type.changed");
  });

  it("classifies required parameter added as breaking", () => {
    const diff: TreeDiff = { path: ["paths", "/v1/charges", "post", "parameters", "required"], op: "added", after: ["amount", "customer"] };
    const result = classifyTreeDiff(diff);
    expect(result.severity).toBe("breaking");
    expect(result.kind).toBe("required.added");
  });

  it("classifies required parameter narrowed as breaking", () => {
    const diff: TreeDiff = { path: ["paths", "/v1/charges", "post", "parameters", "required"], op: "changed", before: ["amount"], after: ["amount", "customer"] };
    const result = classifyTreeDiff(diff);
    expect(result.severity).toBe("breaking");
    expect(result.kind).toBe("required.narrowed");
  });

  it("classifies deprecated flip as deprecation", () => {
    const diff: TreeDiff = { path: ["paths", "/v1/charges", "post", "deprecated"], op: "changed", before: false, after: true };
    const result = classifyTreeDiff(diff);
    expect(result.severity).toBe("deprecation");
    expect(result.kind).toBe("deprecated.flipped");
  });

  it("classifies description changes as docs", () => {
    const diff: TreeDiff = { path: ["paths", "/v1/charges", "post", "description"], op: "changed", before: "old", after: "new" };
    const result = classifyTreeDiff(diff);
    expect(result.severity).toBe("docs");
    expect(result.kind).toBe("docs.description");
  });

  it("classifies schema node removed as breaking", () => {
    const diff: TreeDiff = { path: ["components", "schemas", "Charge", "properties", "amount"], op: "removed" };
    const result = classifyTreeDiff(diff);
    expect(result.severity).toBe("breaking");
    expect(result.kind).toBe("schema.node.removed");
  });

  it("classifies schema node added as feature", () => {
    const diff: TreeDiff = { path: ["components", "schemas", "Refund"], op: "added" };
    const result = classifyTreeDiff(diff);
    expect(result.severity).toBe("feature");
    expect(result.kind).toBe("schema.node.added");
  });

  it("classifies security change as breaking", () => {
    const diff: TreeDiff = { path: ["security", "0", "oauth2"], op: "changed" };
    const result = classifyTreeDiff(diff);
    expect(result.severity).toBe("breaking");
    expect(result.kind).toBe("security.changed");
  });
});

describe("coalesce", () => {
  it("groups sibling leaf diffs under same endpoint", () => {
    // All leaf diffs under same endpoint+method get grouped together
    const diffs: TreeDiff[] = [
      { path: ["paths", "/v1/charges", "post", "parameters", "0", "name"], op: "changed", before: "amount", after: "amount_cents" },
      { path: ["paths", "/v1/charges", "post", "parameters", "0", "schema", "type"], op: "changed", before: "string", after: "integer" },
      { path: ["paths", "/v1/charges", "post", "responses", "200", "description"], op: "changed", before: "OK", after: "Success" },
    ];

    const changes = coalesce(diffs);

    // Implementation groups by endpoint+method (first 3 path segments for paths)
    expect(changes).toHaveLength(1);
    expect(changes[0].jsonPath).toBe("paths./v1/charges.post");
    // Severity is max of group: type.changed (breaking) > docs
    expect(changes[0].severity).toBe("breaking");
  });

  it("groups component schema changes under schema name", () => {
    const diffs: TreeDiff[] = [
      { path: ["components", "schemas", "Charge", "properties", "amount", "type"], op: "changed", before: "string", after: "integer" },
      { path: ["components", "schemas", "Charge", "properties", "currency", "enum"], op: "added", after: ["usd", "eur"] },
    ];

    const changes = coalesce(diffs);

    // Implementation groups by schema (first 4 path segments for components: components.schemas.Charge.properties)
    expect(changes).toHaveLength(1);
    expect(changes[0].jsonPath).toBe("components.schemas.Charge.properties");
    expect(changes[0].severity).toBe("breaking");
    expect(changes[0].before).toBeDefined();
    expect(changes[0].after).toBeDefined();
  });

  it("sorts by severity (breaking first)", () => {
    const diffs: TreeDiff[] = [
      { path: ["components", "schemas", "A", "description"], op: "changed" }, // docs, grouped as components.schemas
      { path: ["paths", "/v1/a", "post"], op: "removed" }, // breaking, grouped as paths./v1/a
      { path: ["components", "schemas", "B"], op: "added" }, // feature, grouped as components.schemas (same prefix as A!)
    ];

    const changes = coalesce(diffs);

    // components.schemas.A.description and components.schemas.B both have prefix "components.schemas"
    // They get grouped together with max severity = feature
    // paths./v1/a is separate with breaking
    expect(changes.length).toBe(2);
    expect(changes[0].severity).toBe("breaking"); // paths./v1/a
    expect(changes[1].severity).toBe("feature");  // components.schemas (merged A + B)
  });

  it("limits to MAX_GROUPED_CHANGES", () => {
    const diffs: TreeDiff[] = Array.from({ length: 70 }, (_, i) => ({
      path: ["paths", `/v1/item${i}`, "post"],
      op: "added" as const,
    }));

    const changes = coalesce(diffs);
    expect(changes.length).toBe(60); // MAX_GROUPED_CHANGES
  });
});

describe("diffNormalizedSpecs", () => {
  it("returns empty array for identical specs", () => {
    const spec = { openapi: "3.0.0", info: { title: "Test", version: "1" }, paths: {} };
    const changes = diffNormalizedSpecs(spec, spec);
    expect(changes).toEqual([]);
  });

  it("detects added endpoint - leaf level changes only", () => {
    const before = { openapi: "3.0.0", info: { title: "Test", version: "1" }, paths: {} };
    const after = {
      openapi: "3.0.0",
      info: { title: "Test", version: "2" },
      paths: { "/v1/new": { post: { summary: "New endpoint" } } },
    };
    const changes = diffNormalizedSpecs(before, after);
    // walkTree detects leaf-level changes; "summary" is in DOC_ONLY_KEYS
    expect(changes.length).toBeGreaterThan(0);
    // The leaf change "summary" is classified as docs
    expect(changes[0].severity).toBe("docs");
  });

  it("detects removed endpoint", () => {
    const before = { openapi: "3.0.0", info: { title: "Test", version: "1" }, paths: { "/v1/old": { get: {} } } };
    const after = { openapi: "3.0.0", info: { title: "Test", version: "2" }, paths: {} };
    const changes = diffNormalizedSpecs(before, after);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0].severity).toBe("breaking");
  });

  it("detects type change in schema", () => {
    const before = {
      openapi: "3.0.0",
      info: { title: "Test", version: "1" },
      components: { schemas: { Item: { type: "object", properties: { id: { type: "string" } } } } },
    };
    const after = {
      openapi: "3.0.0",
      info: { title: "Test", version: "2" },
      components: { schemas: { Item: { type: "object", properties: { id: { type: "integer" } } } } },
    };
    const changes = diffNormalizedSpecs(before, after);
    expect(changes.some((c) => c.severity === "breaking" && c.kind === "type.changed")).toBe(true);
  });
});