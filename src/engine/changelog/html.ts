import * as cheerio from "cheerio";
import type { ChangelogConfig, ChangelogEntry } from "../types";
import type { ChangelogSource } from "./index";

const DEFAULT_SELECTORS = {
  item: "article, .changelog-entry, .entry",
  title: "h2, h3, .entry__title",
  link: "a",
  date: "time",
  content: ".entry__body, p",
};

function parseDate(value: string | undefined, attr: string | undefined): Date {
  const candidate = attr || value;
  if (!candidate) return new Date();
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export class HtmlAdapter implements ChangelogSource {
  constructor(private config: ChangelogConfig) {}

  async fetchLatest(limit: number): Promise<ChangelogEntry[]> {
    if (!this.config.url) return [];
    const res = await fetch(this.config.url, {
      headers: { "user-agent": "SpecWatch/0.1 (+https://specwatch.dev)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${this.config.url}`);
    const html = await res.text();

    const s = { ...DEFAULT_SELECTORS, ...this.config.selectors };
    const $ = cheerio.load(html);
    const base = new URL(this.config.url);

    const entries: ChangelogEntry[] = [];
    $(s.item)
      .slice(0, limit)
      .each((_, el) => {
        const item = $(el);
        const title = item.find(s.title).first().text().trim();
        if (!title) return;
        const href = item.find(s.link).first().attr("href");
        const url = href ? new URL(href, base).toString() : undefined;
        const timeEl = item.find(s.date).first();
        const publishedAt = parseDate(timeEl.text().trim(), timeEl.attr("datetime"));
        const content = item.find(s.content).first().text().trim() || undefined;
        const externalId = url ?? `${title}::${publishedAt.toISOString()}`;
        entries.push({ externalId, title, url, publishedAt, content });
      });

    return entries;
  }
}
