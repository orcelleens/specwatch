import type { ChangelogConfig, ChangelogEntry } from "../types";
import { RssAdapter } from "./rss";
import { HtmlAdapter } from "./html";
import { GitHubReleasesAdapter } from "./github-releases";
import { NullAdapter } from "./null";

export interface ChangelogSource {
  fetchLatest(limit: number): Promise<ChangelogEntry[]>;
}

export function createChangelogSource(config: ChangelogConfig): ChangelogSource {
  switch (config.type) {
    case "rss":
      return new RssAdapter(config);
    case "html":
      return new HtmlAdapter(config);
    case "github-releases":
      return new GitHubReleasesAdapter(config);
    default:
      return new NullAdapter();
  }
}

export type { ChangelogEntry };
