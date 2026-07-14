# Eleza build log

This is an append-only record of the primary Codex collaboration. Each entry preserves the user prompt and records the 2–3 most consequential implementation decisions or outcomes that followed it. Entries 01–13 were reconstructed retroactively on July 14, 2026; entry 14 established this logging practice.

## 01 — Read the architecture sources

Prompt:

> Read AGENTS.md and docs/eleza-prd.md fully before writing any code. Confirm your understanding of the three-system architecture and the five architecture invariants in one short summary, then stop. Do not scaffold anything yet.

Decisions and outcomes:

- Treated the claim graph engine, live voice/examiner loop, and post-viva divergence dossier as three distinct systems joined by explicit contracts.
- Adopted the five non-negotiable constraints: voice talks/examiner decides, one append-only decision log, schema-level rationale receipts, no register comparison, and no verdicts.
- Stopped before scaffolding, preserving the phase boundary requested in the prompt.

## 02 — Recheck the PRD

Prompt:

> Checkk the prd now

Decisions and outcomes:

- Re-read `docs/eleza-prd.md` as the product source of truth before implementation.
- Kept the judge flow and the three visible differentiators—claim anchoring, transparent examiner reasoning, and receipts instead of verdicts—as the acceptance lens.

## 03 — Build the claim graph engine

Prompt:

```text
Build the claim graph engine. Scope: an upload flow accepting .txt and .pdf (extract text server-side), a GPT-5.6 structured-output call producing a graph of nodes (claims, evidence, citations) and edges (supports, rebuts, depends_on) validated against a zod schema, persistence to Supabase, and a graph inspection view rendering nodes/edges with the source paragraph highlighted on node click. Create /prompts/claim-graph.md as the versioned prompt template. Include one synthetic 500-word argumentative sample essay in /fixtures.

Acceptance: uploading the fixture essay produces a graph with ≥6 claim nodes, every node maps to a real document span (character offsets), clicking a node highlights its span, and re-running on the same essay produces structurally similar graphs (spot-check determinism). Also the github repo is Jeremiah-Sakuda/Eleza I want frequent commits, and push when you're done
```

Decisions and outcomes:

- Built server-side `.txt`/`.pdf` extraction, strict Zod graph validation, character-span validation, optional Supabase persistence, and an inspectable document-linked graph.
- Centralized the graph model as `gpt-5.6-sol`, kept the prompt in `prompts/claim-graph.md`, and added only synthetic fixture content.
- Added deterministic fixture verification and split the work into implementation and verification commits (`514d53c`, `cbb3df1`).

## 04 — Use the first frontend reference

Prompt:

> I added a frontend file so we have a starting point, use this as a reference, this is the first page

Referenced file: `/Users/jerem/Desktop/2025 Fall Projects/Eleza/Live Viva Room.dc.html`

Decisions and outcomes:

- Used the supplied editorial visual language—Spectral serif, Instrument Sans, JetBrains Mono, warm paper, graphite, and restrained green—as the UI baseline.
- Treated the HTML as a design reference rather than application source, preserving the Next.js architecture and functional data flow.

## 05 — Continue the claim graph work

Prompt:

> continue

Decisions and outcomes:

- Continued the active claim-graph phase rather than scaffolding later viva or dossier systems.
- Finished fixture-path verification, source-span receipts, and build checks before moving on.

## 06 — Check completion status

Prompt:

> Is the task complete?

Decisions and outcomes:

- Evaluated completion against the repository definition of done rather than code presence alone.
- Kept the task open while acceptance, browser behavior, build health, or delivery steps still needed verification.

## 07 — Finish implementation

Prompt:

> continue with implementation

Decisions and outcomes:

- Completed the remaining claim-graph implementation and verification work without broadening scope.
- Preserved the existing worktree and committed only phase-relevant files.

## 08 — Build Realtime and the pure examiner

Prompt:

```text
Two parallel pieces. (1) Realtime API integration: a session page that conducts a spoken conversation, captures the live transcript with timestamps, and can be fed its next question programmatically — prove this by driving it from a hardcoded question array. (2) The examiner as a pure function: given {transcript_segment, target_claim, graph}, a GPT-5.6 structured-output call returns {answer_summary, target_claim_id, assessment, action: probe|branch|advance, next_question, rationale}. Implement the schema-level rationale gate from AGENTS.md with reject-and-retry (max 2 retries, then flag). Version the prompt in /prompts/examiner.md. Unit-test the examiner against 5 canned answer fixtures (one strong, one restated-conclusion, one contradictory, one evasive, one off-topic).

Acceptance: voice loop sustains a 3-minute conversation driven by the hardcoded array without dropping the session; examiner returns valid, specific output on all 5 fixtures with zero generic rationales surviving the gate.
```

Decisions and outcomes:

- Implemented manual Realtime `response.create` control so the voice layer could speak externally supplied questions without choosing the route.
- Made the examiner injectable and testable, routed the first attempt to Terra and retries to Sol, and enforced exact claim-ID plus transcript-quote receipts through a dynamic Zod refinement.
- Added five canned fixtures, a deterministic three-minute transport proof, and committed/pushed the clean implementation as `801546c`.

## 09 — Configure the OpenAI key

Prompt:

> Where do I need to put the API key?

Decisions and outcomes:

- Directed the key to the repository-root `.env.local` as `OPENAI_API_KEY` so it remains server-only.
- Explicitly kept the credential out of Git and noted that the development server must be restarted after saving it.

## 10 — Design claim inspection and teacher triage

Prompt:

```text
Page 4 — Claim graph inspection

Design the claim graph view shown after a submission is parsed. Not a physics-simulation node cloud. Instead: the document itself remains primary — full essay in black serif in the center column — and the graph lives as a structural index in the left margin: claims listed as small-cap exhibit labels (CLAIM 01…) with their type (claim / evidence / citation) in graphite mono, and their dependency edges drawn as thin bracket lines between labels, like a manuscript's structural outline. Clicking a claim highlights its exact span in the document (a green underline, not a highlighter block) and draws leader lines to the claims it supports or depends on.

A slim toolbar: node count, edge count, "Looks wrong? Edit the graph" (teacher affordance), and "Proceed to viva setup." The feeling: an X-ray of the essay's argument, laid over the essay itself.

Page 5 — Teacher triage (minimal P0 version)

Design a single quiet table: one row per completed viva — student label (anonymous IDs fine), essay title in serif, viva duration, findings count set in amber mono ONLY when nonzero (zero-finding rows stay entirely graphite/black — absence of findings must look like calm, not like a green checkmark), and a "Read dossier" action. Sortable by findings count. Above the table, one line of guidance: "Start with the dossiers that have findings. The evidence is inside." No charts, no class-average widgets, no risk heatmap. The restraint is the design.
```

Decisions and outcomes:

- Interpreted Page 4 as a document-first structural outline, explicitly avoiding a force-directed node cloud and block-style highlights.
- Interpreted Page 5 as intentionally minimal triage, with amber reserved for nonzero findings and no positive-looking treatment for zero findings.
- Inspected the existing route and PRD, but the turn was interrupted before page implementation; the user later chose to own these pages.

## 11 — Verify the newly added API key

Prompt:

> Open AI API key was added, I will work on the pages myself verify that it works

Decisions and outcomes:

- Left the user-owned page designs untouched and limited the task to environment verification.
- Checked credential presence without printing secrets; `.env.local` was empty at that point, so no paid API call was attempted.

## 12 — Wire the adaptive live viva

Prompt:

```text
I have added a UI_design folder with a few more pages, use these going forward. Wire Phase 1 and Phase 2 together into the live viva. The examiner consumes each completed answer and decides the next move; the voice session asks it. Implement the latency pipeline from AGENTS.md: while the examiner processes answer N, the voice model asks a pre-fetched bridge question so the conversation never stalls. Every examiner decision appends to the decision_log table. Build the live reasoning pane: a right-hand panel streaming each log entry as it lands, alongside the transcript.

Acceptance: a full 5-minute viva on the fixture essay runs end-to-end with no dead air over 2 seconds, every question traces to a claim node, and the reasoning pane shows a specific rationale for every routing decision. Run it three times; all three must complete.
```

Decisions and outcomes:

- Added explicit `next_claim_id` routing, deterministic pre-fetched bridge questions, and question metadata so every spoken question traces to a real claim node.
- Made persistence precede UI rendering: only rationale-gated entries successfully appended to the immutable `decision_log` can appear in the reasoning pane.
- Added actual audio-start latency measurement, duplicate-transcription protection, fail-closed shutdown, three deterministic five-minute tests, and checkpointed the implementation as `b725804`.

## 13 — Recheck all credentials and run live acceptance

Prompt:

> All 3 keys should be present now

Decisions and outcomes:

- Verified the OpenAI and Supabase credentials without exposing them, confirmed access to `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-realtime-2.1`, and `gpt-realtime-whisper`, and passed one real examiner rationale-gate call.
- Removed the unsupported `temperature` parameter after the first real GPT-5.6 graph call exposed the incompatibility.
- Added a repeatable real-provider three-run harness (`ebf8e52`); its first run correctly stopped when Supabase revealed that migration `002_live_viva.sql` had not yet been applied.

## 14 — Establish the build-log practice

Prompt:

> Create a build log.md file, I want you to summarize the 2-3 key decisions made by you after every prompt, and include the prompt itself in the file . Add to it after every prompt, and start by retroactively adding all the prompts and decisions so far

Decisions and outcomes:

- Created this root-level, chronological, append-only build log and reconstructed every user prompt in the primary task so far.
- Limited each entry to the 2–3 decisions or outcomes most useful for the README build narrative, including blockers and interrupted work rather than implying completion.
- Added the logging requirement to `Agents.md` so future Codex work appends to this file after every prompt.

## 15 — Identify the remaining manual work

Prompt:

> What do I need to do by hand?

Decisions and outcomes:

- Reduced the immediate manual blocker to one action: apply `supabase/migrations/002_live_viva.sql` in the configured Supabase project's SQL Editor.
- Kept the real-provider verification, database readback, automated tests, build, commits, and eventual push as Codex-owned work after the migration is applied.
- Identified the final microphone acceptance as necessarily human-operated: grant browser microphone permission and speak through the live viva while its measured handoff latency and reasoning pane are observed.

## 16 — Resolve the missing Supabase prerequisite

Prompt:

> I got this error Error: Failed to run sql query: ERROR: 42P01: relation "submissions" does not exist

Decisions and outcomes:

- Diagnosed the error as an unapplied prerequisite migration: `002_live_viva.sql` references the `submissions` table created by `001_claim_graphs.sql`.
- Kept the schema normalized instead of duplicating or manually recreating `submissions` inside migration 002.
- Directed the migrations to be applied in filename order; both use idempotent `if not exists` statements, so rerunning 002 after 001 is safe.

## 17 — Confirm the Supabase migrations

Prompt:

> Complete, I got Success. No rows returned

Decisions and outcomes:

- Interpreted “Success. No rows returned” as the expected result for DDL migrations rather than a missing-data failure.
- Chose to verify the new tables with a real selectable query before spending additional model calls.
- Resumed the three-run real-provider acceptance harness only after that database verification.

Verification results:

- All three GPT-5.6/Supabase runs completed with eight persisted, claim-specific decisions each and bridge-selection latency below one millisecond.
- A separate genuine Realtime probe revealed that raw response-level question instructions could make the voice model answer the question; the delivery contract was moved into a versioned “speak exactly, do not answer” template before final voice verification.
- The corrected genuine `gpt-realtime-2.1` probe spoke the claim-tagged question exactly, with no greeting, answer, or follow-up.

## 18 — Build post-viva divergence analysis and dossier

Prompt:

```text
Build post-viva divergence analysis: compare the transcript against the claim graph for the three divergence types (cannot_reconstruct, mechanism_gap, inconsistency — nothing else). Each finding: {timestamp, transcript_excerpt, claim_id, doc_span, type, note}. Generate the dossier view: claims defended (with excerpts), findings (each linking timestamp ↔ highlighted document span), full transcript, full decision log. Version the prompt in /prompts/divergence.md.

Acceptance: running the dossier on a deliberately weak viva (I'll record one where I can't defend paragraph 3) produces at least one cannot_reconstruct finding pointing at the correct span, and zero findings on the paragraphs I defended well.
```

Decisions and outcomes:

- Restricted divergence output in both the prompt and strict Zod schema to `cannot_reconstruct`, `mechanism_gap`, and `inconsistency`, then added semantic receipt validation for exact claim IDs, timestamps, answer excerpts, assessment support, and graph-owned source spans.
- Kept raw transcript turns and the existing append-only `decision_log` as canonical evidence; the dossier stores only the validated analysis and renders the full records directly from their source tables.
- Added a deliberately weak paragraph-three fixture and verified it with real `gpt-5.6-sol`: one `cannot_reconstruct` finding at characters 801–1271, two defended claims, and zero findings on the defended paragraphs.
