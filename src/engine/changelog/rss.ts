import Parser from "rss-parser";
import type { ChangelogConfig, ChangelogEntry } from "../types";
import type { ChangelogSource } from "./index";

const parser = new Parser({ timeout: 15_000 });

export class RssAdapter implements ChangelogSource {
  constructor(private config: ChangelogConfig) {}

  async fetchLatest(limit: number): Promise<ChangelogEntry[]> {
    if (!this.config.url) return [];
    const feed = await parser.parseURL(this.config.url);
    return feed.items.slice(0, limit).map((item) => ({
      externalId: item.guid ?? item.link ?? item.title ?? String(item.isoDate),
      title: item.title ?? "Untitled entry",
      url: item.link ?? undefined,
      publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
      content: item.contentSnippet ?? item.content ?? undefined,
    }));
  }
}
