import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleChanges } from "./detect";
import type { VendorConfig, ClassifiedChange, ChangelogEntry } from "@/engine/types";

// Mock the dependencies - we need to properly chain the mock
const createChain = (resolveValue: any) => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue(resolveValue),
    update: vi.fn().mockReturnThis(),
  };
  return chain;
};

const mockWatchlistChain = createChain({ data: [], error: null });
const mockChangesChain = createChain({ error: null });
const mockAuthAdmin = {
  getUserById: vi.fn().mockResolvedValue({
    data: { user: { email: "test@example.com" } },
    error: null,
  }),
};

const mockDb = {
  from: vi.fn((table: string) => {
    if (table === "watchlist") return mockWatchlistChain;
    if (table === "changes") return mockChangesChain;
    return createChain({ data: [], error: null });
  }),
  auth: { admin: mockAuthAdmin },
};

vi.mock("@/modules/db/client", () => ({
  serviceClient: vi.fn(() => mockDb),
}));

vi.mock("@/modules/billing/plan", () => ({
  getPlan: vi.fn(),
}));

vi.mock("@/modules/notify/email", () => ({
  alertEmail: vi.fn(() => ({ subject: "Test", html: "<p>Test</p>" })),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/modules/notify/slack", () => ({
  sendSlack: vi.fn().mockResolvedValue(undefined),
}));

import { serviceClient } from "@/modules/db/client";
import { getPlan } from "@/modules/billing/plan";
import { alertEmail, sendEmail } from "@/modules/notify/email";
import { sendSlack } from "@/modules/notify/slack";

const mockVendor: VendorConfig = {
  id: "vendor-1",
  slug: "stripe",
  name: "Stripe",
  specUrl: "https://api.stripe.com/openapi.yaml",
  specFormat: "openapi3",
  changelog: { type: "none" },
  pollIntervalMinutes: 60,
  pollOffsetMinutes: 0,
};

const mockChanges: ClassifiedChange[] = [
  {
    jsonPath: "paths./v1/charges.post.parameters.0",
    kind: "param.added",
    severity: "breaking",
    summary: "Stripe added required parameter 'customer'",
    impactHint: "Update your charge calls",
  },
];

const mockEntries: ChangelogEntry[] = [
  {
    externalId: "changelog-1",
    title: "New parameter",
    url: "https://stripe.com/changelog/1",
    publishedAt: new Date(),
  },
];

const mockChangeIds = ["change-1", "change-2"];

describe("handleChanges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWatchlistChain.select.mockReturnThis();
    mockWatchlistChain.eq.mockResolvedValue({ data: [], error: null });
    mockChangesChain.update.mockReturnThis();
    mockChangesChain.in.mockResolvedValue({ error: null });
  });

  const setupWatchers = (watchers: any[]) => {
    mockWatchlistChain.eq.mockResolvedValueOnce({ data: watchers, error: null });
  };

  it("skips free plan users", async () => {
    vi.mocked(getPlan).mockResolvedValue("free");
    setupWatchers([{ user_id: "user-1", notify_all: true, slack_webhook_url: null }]);

    await handleChanges(mockVendor, mockChanges, mockEntries, mockChangeIds);

    expect(getPlan).toHaveBeenCalledWith("user-1");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSlack).not.toHaveBeenCalled();
  });

  it("sends email to pro plan users with notify_all=true", async () => {
    vi.mocked(getPlan).mockResolvedValue("pro");
    setupWatchers([{ user_id: "user-1", notify_all: true, slack_webhook_url: null }]);

    await handleChanges(mockVendor, mockChanges, mockEntries, mockChangeIds);

    expect(getPlan).toHaveBeenCalledWith("user-1");
    expect(alertEmail).toHaveBeenCalledWith({
      vendorName: "Stripe",
      changes: mockChanges,
      entries: mockEntries,
      permalinkBase: expect.any(String),
    });
    expect(sendEmail).toHaveBeenCalledWith({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });
  });

  it("sends email only for important changes when notify_all=false", async () => {
    vi.mocked(getPlan).mockResolvedValue("pro");

    const nonBreakingChanges: ClassifiedChange[] = [
      { jsonPath: "paths./v1/charges.post.description", kind: "docs.description", severity: "docs" },
    ];

    setupWatchers([{ user_id: "user-1", notify_all: false, slack_webhook_url: null }]);

    await handleChanges(mockVendor, nonBreakingChanges, [], mockChangeIds);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends email for breaking changes even when notify_all=false", async () => {
    vi.mocked(getPlan).mockResolvedValue("pro");
    setupWatchers([{ user_id: "user-1", notify_all: false, slack_webhook_url: null }]);

    await handleChanges(mockVendor, mockChanges, [], mockChangeIds);

    expect(sendEmail).toHaveBeenCalled();
  });

  it("sends Slack when webhook configured", async () => {
    vi.mocked(getPlan).mockResolvedValue("pro");
    setupWatchers([{ user_id: "user-1", notify_all: true, slack_webhook_url: "https://hooks.slack.com/test" }]);

    await handleChanges(mockVendor, mockChanges, mockEntries, mockChangeIds);

    expect(sendSlack).toHaveBeenCalledWith(
      "https://hooks.slack.com/test",
      "Stripe",
      mockChanges,
      mockEntries
    );
  });

  it("marks changes as notified", async () => {
    vi.mocked(getPlan).mockResolvedValue("pro");
    setupWatchers([{ user_id: "user-1", notify_all: true, slack_webhook_url: null }]);

    await handleChanges(mockVendor, mockChanges, mockEntries, mockChangeIds);

    expect(mockDb.from).toHaveBeenCalledWith("changes");
    expect(mockChangesChain.update).toHaveBeenCalledWith({ notified_at: expect.any(String) });
  });

  it("handles empty watchers list", async () => {
    setupWatchers([]);

    await handleChanges(mockVendor, mockChanges, mockEntries, mockChangeIds);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendSlack).not.toHaveBeenCalled();
  });

  it("continues on email failure", async () => {
    vi.mocked(getPlan).mockResolvedValue("pro");
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Email failed"));
    setupWatchers([{ user_id: "user-1", notify_all: true, slack_webhook_url: null }]);

    // Should not throw
    await expect(handleChanges(mockVendor, mockChanges, mockEntries, mockChangeIds)).resolves.not.toThrow();
  });
});