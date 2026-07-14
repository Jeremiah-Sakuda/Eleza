# Eleza — Agent Instructions

Read `docs/eleza-prd.md` before any task. It is the source of truth for scope. This file is the source of truth for how to build.

## What this is

A voice oral-defense tool for student work. Three systems: (1) claim graph engine that parses a submission into claims/evidence/dependency nodes, (2) a live viva where a Realtime voice session converses while a parallel GPT-5.6 "examiner" decides every next move, (3) post-viva divergence analysis producing an evidence dossier. The examiner's live reasoning pane and the dossier are two views over one append-only decision log.

## Architecture invariants (never violate, never "simplify away")

- **The voice model talks; the examiner decides.** The Realtime session NEVER chooses its own next question. It receives it from the examiner's structured output. If latency pressure tempts you to let the voice model freelance, use the bridge-question pipeline instead (examiner evaluates answer N while voice asks a pre-fetched bridge for N+1).
- **One decision log.** Every examiner decision is an append-only entry: `{answer_summary, target_claim_id, assessment, action, rationale}`. The live pane and the dossier both render from this log. Do not create parallel state.
- **Rationale quality gate is schema-level, not prompt-level.** Reject and retry any examiner output whose rationale fails to (a) cite the target claim_id and (b) quote at least one phrase from the student's actual answer. Generic rationales ("answer was vague") are the project's primary failure mode.
- **No register/vocabulary comparison anywhere.** Divergence detection is content-reconstruction only (cannot-reconstruct, mechanism-gap, inconsistency). Written-vs-spoken register analysis is excluded by design for bias reasons. Do not add it as a "quick win."
- **No verdicts.** No authenticity score, no percentage, no pass/fail, no "likely AI" output anywhere in code, UI copy, or variable names. Dossiers present evidence; humans decide.

## Stack

Next.js (App Router) + Tailwind. OpenAI Realtime API for voice; GPT-5.6 via Responses API with structured outputs for graph/examiner/divergence. Supabase Postgres for sessions and logs. Vercel deploy. No telephony, no third-party assessment SDKs, no auth for the judge demo flow.

## Model routing (do not default everything to one model string)

| Call site | Model | Why |
|---|---|---|
| Claim graph engine | `gpt-5.6-sol` | Runs once per submission, latency-irrelevant; all downstream question quality inherits from node granularity. Never economize here. |
| Examiner (live turn loop) | `gpt-5.6-terra` | Latency is the binding constraint in the viva loop; Terra is GPT-5.5-class at half cost. |
| Examiner retry (rationale gate failure) | `gpt-5.6-sol` | When Terra's output fails the schema-level rationale gate, retry ONCE on Sol rather than re-rolling Terra. The quality gate doubles as the model router. |
| Divergence analysis | `gpt-5.6-sol` | Post-viva, async; produces the receipts teachers act on. Errors here do real damage. |
| Voice conversation | Realtime API model | Whatever the current Realtime model is; it talks, it does not decide. |

Do not use Luna anywhere in v1 — no call site matches its profile, and forcing it in is tiering theater.

**Caching discipline:** structure every examiner call as [stable cached prefix: system prompt + full claim graph] + [fresh suffix: latest transcript segment]. Cache reads are 90% off and the graph is re-read every turn — this prefix structure is most of the project's token budget. Keep the prefix byte-identical across turns (no timestamps or turn counters inside it) or the cache misses. Centralize model strings in one config file (`lib/models.ts`) so tier changes are one-line edits.

## Working style

- Build in the phases I give you; do not scaffold ahead of the current phase.
- Prefer boring, inspectable code over clever abstractions — judges read this repo.
- Every prompt template lives in `/prompts` as a versioned file, not inline strings.
- When you make a non-obvious tradeoff, add one comment line: `// DECISION: <what and why>`. These get harvested for the README's build narrative.
- Synthetic sample essays only; nothing copyrighted, no real student work, no real institution names.

## Definition of done, per phase

A phase is done when its acceptance criteria pass AND `npm run build` is clean AND the demo path for that phase works end-to-end in the browser. Do not report done otherwise.