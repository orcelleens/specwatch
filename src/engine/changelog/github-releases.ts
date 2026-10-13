import type { ChangelogConfig, ChangelogEntry } from "../types";
import type { ChangelogSource } from "./index";

/**
 * GitHub Releases changelog adapter.
 *
 * For niche APIs the SDK repo's releases are often the *only* changelog.
 * Config `url` accepts `owner/repo`, a repo URL
 * (`https://github.com/owner/repo`), or a full API URL.
 * Uses the public REST API unauthenticated (60 req/h/IP is ample at our
 * poll cadence, and changelog failures never fail the spec poll).
 */
export class GitHubReleasesAdapter implements ChangelogSource {
  constructor(private config: ChangelogConfig) {}

  private apiUrl(): string | null {
    const raw = this.config.url?.trim();
    if (!raw) return null;
    if (raw.startsWith("https://api.github.com/")) return raw;
    const repo = raw
      .replace(/^https?:\/\/github\.com\//, "")
      .replace(/\.git$/, "")
      .replace(/\/$/, "");
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
    return `https://api.github.com/repos/${repo}/releases`;
  }

  async fetchLatest(limit: number): Promise<ChangelogEntry[]> {
    const url = this.apiUrl();
    if (!url) return [];
    const res = await fetch(`${url}?per_page=${Math.min(limit, 100)}`, {
      headers: {
        "user-agent": "SpecWatch/0.1 (+https://specwatch.dev)",
        accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const releases = (await res.json()) as Array<{
      id?: number;
      tag_name?: string;
      name?: string;
      html_url?: string;
      published_at?: string;
      body?: string;
    }>;
    if (!Array.isArray(releases)) return [];
    return releases.slice(0, limit).map((r) => ({
      externalId: String(r.id ?? r.tag_name ?? r.html_url ?? ""),
      title: r.name ?? r.tag_name ?? "Untitled release",
      url: r.html_url ?? undefined,
      publishedAt: r.published_at ? new Date(r.published_at) : new Date(),
      content: r.body?.slice(0, 2_000) ?? undefined,
    }));
  }
}
