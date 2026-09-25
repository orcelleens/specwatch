import type { RawChange, Severity } from "../types";
import { maxSeverity } from "../types";

export type DiffOperation = "added" | "removed" | "changed";

export interface TreeDiff {
  path: string[];
  op: DiffOperation;
  before?: unknown;
  after?: unknown;
}

const MAX_GROUPED_CHANGES = 60;

const DEPRECATED_KEYS = new Set(["deprecated", "x-deprecated"]);
const DOC_ONLY_KEYS = new Set([
  "description",
  "summary",
  "title",
  "$$description",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

export function walkTree(
  before: unknown,
  after: unknown,
  path: string[],
  out: TreeDiff[],
): void {
  if (deepEqual(before, after)) return;

  if (isPlainObject(before) && isPlainObject(after)) {
    for (const key of Object.keys(before)) {
      if (!Object.prototype.hasOwnProperty.call(after, key)) {
        out.push({ path: [...path, key], op: "removed", before: before[key] });
      } else {
        walkTree(before[key], after[key], [...path, key], out);
      }
    }
    for (const key of Object.keys(after)) {
      if (!Object.prototype.hasOwnProperty.call(before, key)) {
        out.push({ path: [...path, key], op: "added", after: after[key] });
      }
    }
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    // index-wise comparison: appends and removals at the tail are exact;
    // a reorder surfaces as changed indices, which coalescing absorbs
    const n = Math.max(before.length, after.length);
    for (let i = 0; i < n; i++) {
      const seg = String(i);
      if (i >= after.length) {
        out.push({ path: [...path, seg], op: "removed", before: before[i] });
      } else if (i >= before.length) {
        out.push({ path: [...path, seg], op: "added", after: after[i] });
      } else {
        walkTree(before[i], after[i], [...path, seg], out);
      }
    }
    return;
  }

  out.push({ path, op: "changed", before, after });
}

function isBreakingTypeChange(before: unknown, after: unknown): boolean {
  if (!isPlainObject(before) || !isPlainObject(after)) return true;
  const bt = before.type;
  const at = after.type;
  if (bt !== at) return true;
  // format narrowing (e.g. string -> string+enum) is not breaking; format widening is
  return false;
}

/**
 * Deterministic severity rules over the canonical OpenAPI tree.
 * Leaf-key and path-context driven; no LLM involved.
 */
export function classifyTreeDiff(diff: TreeDiff): { severity: Severity; kind: string } {
  const last = diff.path[diff.path.length - 1];
  const parent = diff.path[diff.path.length - 2];

  // deprecation flips
  if (DEPRECATED_KEYS.has(last) && diff.op === "changed") {
    const truthy = (v: unknown) => v === true || v === "true";
    if (truthy(diff.before) === false && truthy(diff.after) === true) {
      return { severity: "deprecation", kind: "deprecated.flipped" };
    }
  }

  // description-ish leaf edits
  if (DOC_ONLY_KEYS.has(last)) {
    return { severity: "docs", kind: `docs.${last}` };
  }
  if (diff.path.some((seg) => DOC_ONLY_KEYS.has(seg))) {
    return { severity: "docs", kind: "docs.nested" };
  }

  const inPaths = diff.path[0] === "paths";
  const inComponents = diff.path[0] === "components" || diff.path[0] === "definitions";

  if (inPaths || inComponents) {
    // top-level object additions/removals inside paths/components
    if (diff.path.length <= 2) {
      return {
        severity: diff.op === "removed" ? "breaking" : "feature",
        kind: `${diff.path[0]}.${diff.op}`,
      };
    }

    // removed endpoints or operations
    if (diff.op === "removed") {
      if (inPaths) {
        return { severity: "breaking", kind: "endpoint.removed" };
      }
      return { severity: "breaking", kind: "schema.node.removed" };
    }

    // newly required request parameters / properties
    if (last === "required" && diff.op === "changed") {
      return { severity: "breaking", kind: "required.narrowed" };
    }
    if (last === "required" && diff.op === "added") {
      return { severity: "breaking", kind: "required.added" };
    }

    // type changes
    if (last === "type" && diff.op === "changed") {
      return { severity: "breaking", kind: "type.changed" };
    }
    if (isBreakingTypeChange(diff.before, diff.after) && diff.op === "changed" && parent === "schema") {
      return { severity: "breaking", kind: "schema.changed" };
    }

    // added operations / endpoints / params = new surface
    if (diff.op === "added") {
      return { severity: "feature", kind: inPaths ? "endpoint.added" : "schema.node.added" };
    }
    return { severity: "docs", kind: "spec.changed" };
  }

  // security changes at document root
  if (diff.path[0] === "security" || diff.path[0] === "securitySchemes") {
    return { severity: "breaking", kind: "security.changed" };
  }

  return { severity: "docs", kind: "meta.changed" };
}

/**
 * Group sibling leaf diffs into one human-meaningful change per operation/schema.
 * E.g. 12 leaf diffs under paths./v1/charges.post become one change.
 */
export function coalesce(treeDiffs: TreeDiff[]): RawChange[] {
  const groups = new Map<string, { diffs: TreeDiff[]; severity: Severity; kind: string }>();

  for (const diff of treeDiffs) {
    let prefix: string;
    if (diff.path[0] === "paths" && diff.path.length > 3) {
      // paths.{endpoint}.{method}.*
      prefix = diff.path.slice(0, 3).join(".");
    } else if (diff.path[0] === "components" && diff.path.length > 4) {
      // components.schemas.{name}.* (schemas/parameters/responses)
      prefix = diff.path.slice(0, 4).join(".");
    } else {
      prefix = diff.path.slice(0, 2).join(".");
    }

    const { severity, kind } = classifyTreeDiff(diff);
    const existing = groups.get(prefix);
    if (existing) {
      existing.diffs.push(diff);
      existing.severity = maxSeverity(existing.severity, severity);
      // keep the most alarming kind for the group's headline
      if (severity === "breaking" && existing.severity === "breaking") {
        existing.kind = kind;
      }
    } else {
      groups.set(prefix, { diffs: [diff], severity, kind });
    }
  }

  const changes: RawChange[] = [];
  for (const [prefix, group] of groups) {
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const d of group.diffs) {
      const rel = d.path.join(".");
      if (d.op === "removed") before[rel] = d.before;
      else if (d.op === "added") after[rel] = d.after;
      else {
        before[rel] = d.before;
        after[rel] = d.after;
      }
    }
    changes.push({
      jsonPath: prefix,
      kind: group.kind,
      severity: group.severity,
      before: Object.keys(before).length ? before : undefined,
      after: Object.keys(after).length ? after : undefined,
    });
  }

  changes.sort((a, b) => a.severity.localeCompare(b.severity));
  return changes.slice(0, MAX_GROUPED_CHANGES);
}

export function diffNormalizedSpecs(before: unknown, after: unknown): RawChange[] {
  const treeDiffs: TreeDiff[] = [];
  walkTree(before, after, [], treeDiffs);
  return coalesce(treeDiffs);
}
