# AGENTS.md — how to work on SpecWatch

> Start every session by reading `HANDOFF.md` (current state + next steps),
> then this file, then `SIGNAL.md` (product rationale).

## Owner's working preferences (always)

- **Tell the owner what you are going to do, and sanity-check it yourself
  before asking whether it is the right thing.** The owner confirms direction;
  you own the reasoning.
- **Work in the S-A-A-S frame** (Signal → Architecture → Aesthetics → Social,
  see `HANDOFF.md` §5) and prefer deep-module improvements
  (`/improve-codebase-architecture` mindset) over surface edits. Parallelise
  independent work (`/swarm-orchestration` mindset) when it is safe.
- **Browser checks**: use the VS Code integrated browser. Do not spawn a
  separate Chrome/Chromium instance.
- Auth and deployment are already fixed and passing — don't rework them
  without a failing test or a concrete bug.

## Architecture rules (do not violate)

- `src/engine/` is framework-free: no Next, React, or app imports — pure
  libraries only. It is the acquirable core and must stay liftable into a
  worker/npm package unchanged. Dependencies enter via `EngineDeps`
  (`EngineStore`, `SnapshotStorage`, `Classifier`).
- App logic lives in `src/modules/` (deep modules with small interfaces);
  `src/app/` is thin glue (pages, server actions, cron routes).
- Source-format detection is authoritative in `engine/normalizer.ts`
  (`detectSourceKind`); stored `source_kind`/`spec_format` are hints only.
- Severity is deterministic (differ rules). The LLM only writes prose and
  must always have the template fallback; never let an LLM call be required
  for a poll to succeed.
- Changelog failures never fail a spec poll. One vendor's failure never
  affects another vendor.
- Clerk = auth, Supabase = DB/storage (service role, server-side only, RLS
  deny-by-default). Private vendors (`visibility='private'`) must never leak
  into public pages or queries.

## Before calling anything done

```bash
npm run typecheck && npm run lint && npm test && npm run build
npx tsx scripts/engine-smoke.ts   # legs 1–3 are the offline gate
```

Then update `HANDOFF.md` (§2 what changed, §4 next steps, verification
results) so the next chat can continue cold. Keep the diff focused; match
the existing zinc/orange design system and code style.
