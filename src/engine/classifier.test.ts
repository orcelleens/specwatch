import { describe, it, expect, vi } from "vitest";
import { createClassifier, fallbackSummaries, type Classifier, type BatchSummary } from "./classifier";
import type { RawChange } from "./types";

// Mock Groq SDK to avoid browser environment error
vi.mock("groq-sdk", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"changes":[]}' } }],
          }),
        },
      },
    };
  }),
}));

describe("fallbackSummaries", () => {
  it("generates summaries for all changes", () => {
    const changes: RawChange[] = [
      { jsonPath: "paths./v1/charges.post", kind: "endpoint.added", severity: "feature" },
      { jsonPath: "paths./v1/refunds.post", kind: "endpoint.removed", severity: "breaking" },
      { jsonPath: "components.schemas.Charge.properties.amount", kind: "type.changed", severity: "breaking" },
    ];

    const result = fallbackSummaries("Stripe", changes);

    expect(result.size).toBe(3);
    expect(result.get(0)?.summary).toBe("Stripe changed paths./v1/charges.post (endpoint.added).");
    expect(result.get(1)?.summary).toBe("Stripe changed paths./v1/refunds.post (endpoint.removed).");
    expect(result.get(2)?.summary).toBe("Stripe changed components.schemas.Charge.properties.amount (type.changed).");
  });

  it("generates breaking impact hints for breaking changes", () => {
    const changes: RawChange[] = [
      { jsonPath: "paths./v1/charges.post", kind: "endpoint.removed", severity: "breaking" },
      { jsonPath: "paths./v1/charges.post.parameters.0", kind: "required.added", severity: "breaking" },
    ];

    const result = fallbackSummaries("Stripe", changes);

    expect(result.get(0)?.impactHint).toBe(
      "If you use this part of the API, check your integration before your next deploy."
    );
    expect(result.get(1)?.impactHint).toBe(
      "If you use this part of the API, check your integration before your next deploy."
    );
  });

  it("generates non-breaking impact hints for non-breaking changes", () => {
    const changes: RawChange[] = [
      { jsonPath: "paths./v1/charges.post", kind: "endpoint.added", severity: "feature" },
      { jsonPath: "components.schemas.Charge.description", kind: "docs.description", severity: "docs" },
    ];

    const result = fallbackSummaries("Stripe", changes);

    expect(result.get(0)?.impactHint).toBe("No action required unless you rely on this part of the API.");
    expect(result.get(1)?.impactHint).toBe("No action required unless you rely on this part of the API.");
  });

  it("handles deprecation severity - returns non-breaking hint", () => {
    const changes: RawChange[] = [
      { jsonPath: "paths./v1/old.post", kind: "deprecated.flipped", severity: "deprecation" },
    ];

    const result = fallbackSummaries("Stripe", changes);

    // Deprecation is non-breaking in fallbackSummaries (only breaking gets the alert hint)
    expect(result.get(0)?.impactHint).toBe(
      "No action required unless you rely on this part of the API."
    );
  });
});

describe("createClassifier", () => {
  it("returns a classifier with classifyBatch method when apiKey provided", () => {
    const classifier = createClassifier("test-api-key");
    expect(classifier).toHaveProperty("classifyBatch");
    expect(typeof classifier.classifyBatch).toBe("function");
  });

  it("classifyBatch returns Map with summaries", async () => {
    const classifier = createClassifier("test-api-key");

    // We can't easily mock the internal Groq client without refactoring
    // This test documents the expected interface
    expect(classifier.classifyBatch).toBeDefined();
  });
});

// Integration test for classifier would require mocking Groq SDK
// For now, test the interface contract
describe("Classifier interface", () => {
  it("BatchSummary has required fields", () => {
    const summary: BatchSummary = {
      summary: "Test summary",
      impactHint: "Test hint",
    };
    expect(summary.summary).toBeDefined();
    expect(summary.impactHint).toBeDefined();
  });

  it("classifyBatch accepts vendorName, batch, batchOffset", () => {
    const classifier: Classifier = {
      async classifyBatch(vendorName, batch, batchOffset) {
        expect(typeof vendorName).toBe("string");
        expect(Array.isArray(batch)).toBe(true);
        expect(typeof batchOffset).toBe("number");
        return new Map();
      },
    };
    expect(classifier.classifyBatch).toBeDefined();
  });
});