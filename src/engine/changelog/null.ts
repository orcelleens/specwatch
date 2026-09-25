import type { ChangelogEntry } from "../types";
import type { ChangelogSource } from "./index";

export class NullAdapter implements ChangelogSource {
  async fetchLatest(): Promise<ChangelogEntry[]> {
    return [];
  }
}

export type { ChangelogEntry };
