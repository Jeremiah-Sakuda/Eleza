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

## 19 — Apply the dossier persistence migration

Prompt:

> Succeeded

Decisions and outcomes:

- Treated the Supabase success response as authorization to resume the previously blocked stored acceptance path, without altering or reapplying the schema.
- Ran the complete synthetic weak-viva path through Supabase and real `gpt-5.6-sol`; it persisted two defended claims and one paragraph-three `cannot_reconstruct` finding at the exact 801–1271 span.
- Verified the rendered dossier in the browser: timestamp and transcript anchors navigate correctly, the document receipt uses an underline rather than a block highlight, both complete appendix records expand, and the page reports no browser errors.

## 20 — Build the public judge demo and deployment path

Prompt:

```text
Build the zero-login judge demo: landing page with the fixture essay, a "defend this essay yourself" button starting a 2-minute viva, dossier delivered on completion. Add practice mode (unrecorded warm-up on a second sample) and the text-mode accessibility fallback (typed answers through the same examiner loop). Add the minimal teacher triage view: a table of completed vivas sorted by finding count, linking to dossiers. Deploy to Vercel with rate limiting on session creation (per-IP, and a global daily cap). Add the AI-interaction disclosure line to the viva start screen.

Acceptance: a stranger with the URL can complete the full judge flow on a phone and a laptop with no instructions; rate limiter blocks the 6th session from one IP; text mode produces a dossier equivalent to voice mode.
```

Decisions and outcomes:

- Made the public landing instant by shipping deterministic, span-validated graphs for two synthetic samples; the primary sample starts a two-minute recorded viva, while practice uses the same examiner and routing logic but writes no session, transcript, decision, or dossier records.
- Routed typed answers through the same `/api/viva/turn` persistence and examiner quality gate as voice answers, so both modes converge on the identical dossier completion endpoint and append-only decision log.
- Added an atomic Supabase limiter with salted IP hashes, a five-session per-IP daily cap, a configurable global daily cap, and a real-dossier triage table; local tests and production build pass, with stored acceptance and deployment pending migration 004.

## 21 — Harden the judge demo for production

Prompt:

```text
Prepare the app for production deploy. Codex-owned work: (1) Ephemeral token endpoint — a server route minting short-lived Realtime client tokens; the browser connects to the Realtime API directly, audio never proxies through serverless functions, OPENAI_API_KEY never reaches the client; shortest TTL the API allows; same rate limits as viva creation. (2) Rate limiting — per-IP cap on viva/token creation (5/day) and a global daily cap (env var, default 200), enforced server-side via the hashed-IP column on vivas; limit responses are plain and honest, no apology, state when to retry. (3) Keep-alive — /api/health doing a trivial Supabase select + vercel.json cron pinging it daily (free tier pauses after ~7 days idle). (4) Config hygiene — all secrets from env vars only, nothing sensitive under NEXT_PUBLIC_, .env.local gitignored, add .env.example documenting the three vars. (5) Judge-demo vivas hard-capped at 2.5 minutes server-side. (6) README deployment section written for a judge reproducing from a fresh clone. End with a checklist of my by-hand steps (Vercel linking, dashboard env vars, OpenAI spend cap, migrations).

Acceptance: HTTPS URL serves the app; mic permission works on the production domain in Chrome and Safari, desktop and one phone; a full viva completes against production; the 6th same-IP attempt is refused; /api/health returns 200 with cron registered; no secret in client bundles (search the built output).
```

Decisions and outcomes:

- Replaced the server-proxied SDP route with a rate-authorized `/api/realtime/token` endpoint and direct browser-to-OpenAI WebRTC exchange; official Realtime documentation currently fixes client-secret expiry at one minute, and the standard API key remains server-only.
- Reworked quotas around `viva_sessions.request_ip_hash`: atomic Postgres functions enforce five session creations and five token issuances per salted IP digest per UTC day, a configurable global cap defaulting to 200, and a database-level 150-second maximum checked again before examiner turns.
- Added a Supabase health select, daily Vercel cron, fresh-clone deployment README, exact environment example, and built-client secret scanner; 16 tests, TypeScript, production build, and a 30-asset bundle scan pass pending migration 004 and hosted-device verification.

## 22 — Production migration confirmation and live acceptance

Prompt:

> Succeeded

Decisions and outcomes:

- Treated the confirmation as authorization to run the database-backed production acceptance suite: the sixth same-IP viva and token attempts were refused, while oversized judge sessions were clamped to 150 seconds.
- Ran the typed judge flow in the browser through two schema-gated examiner decisions and dossier generation, then verified the new zero-finding dossier appeared in the findings-sorted teacher triage view and that the landing flow remained usable at a 390-by-844 phone viewport.
- Tested a real OpenAI client-secret mint rather than relying on documentation defaults; the live API defaulted to roughly 10 minutes, so the endpoint now explicitly requests the supported 10-second minimum and an automated check confirms the returned lifetime without printing the token.

## 23 — Repair voice turn control and clarify follow-ups

Prompt:

> So a few things, I got this error: The WebRTC voice connection failed. And I also think there should be a button that allows the student to end their turn, so the examiner can move on to their next question. Do we allow the examiner to ask follow ups?

Decisions and outcomes:

- Confirmed production Supabase health and matched the ephemeral-token SDP exchange to OpenAI's current WebRTC guidance, then added peer/ICE-state diagnostics, a 15-second connection timeout, and Safari-safe remote-audio playback instead of leaving the generic failure opaque.
- Replaced semantic pause detection with an explicit `Finish answer` control: VAD is disabled, the microphone is muted while questions play, each answer buffer is cleared before listening, and the student's button press commits exactly one answer for transcription.
- Preserved examiner-owned follow-ups: `action: probe` asks a claim-specific follow-up on the same claim, while schema validation prevents the voice model from inventing or rerouting questions. The updated manual-turn session minted a real 11-second client token; all 18 tests, TypeScript, the production build, and the client-secret bundle scan pass.

## 24 — Harvest the Codex build narrative and complete the README

Prompt:

> Ensure the build log has been updated, then harvest every // DECISION: comment and the git history into a draft README section titled "Building with Codex" — organized as: what Codex built, where I overrode it and why, how GPT-5.6 is used in each of the three systems. Full README pass: setup, env vars, sample data, testing instructions for judges. Confirm npm run build clean and Vercel deploy green.

Decisions and outcomes:

- Harvested all 13 implementation `// DECISION:` receipts and all 15 existing commits into a traceable “Building with Codex” narrative, grouped by shipped system and linked back to the relevant source files, prompts, fixtures, and model-routing configuration.
- Made the human contribution explicit: the architecture and bias guardrails, manuscript-style UI direction, explicit student-controlled answer boundary, and human-owned production credentials/migrations are recorded as deliberate overrides rather than presented as Codex autonomy.
- Reworked the complete README around the hosted judge flow, three-system architecture, fresh-clone setup, exact environment exposure, synthetic sample inventory, offline/provider-backed test commands, hosted acceptance, and Vercel reproduction. All 18 tests, TypeScript, `npm run build`, and the 30-asset client-secret scan pass.

## 25 — Complete the submission-readiness compliance pass

Prompt:

```text
README + repo submission-readiness pass. Four fixes, no scope creep:

1. LICENSE: Add an MIT LICENSE file at the repo root (copyright 2026
   Jeremiah Sakuda). Add a short "License" section at the bottom of the
   README linking to it. The hackathon rules require a public repo to
   carry relevant licensing — this is a compliance item.

2. Positioning paragraph: Add 3–4 sentences to the README intro,
   directly after the current opening paragraph, establishing how Eleza
   differs from existing oral-assessment tools. The honest frame is
   "improves on existing concepts," not "first ever." Content to convey:
   AI oral-assessment tools exist (research deployments and commercial
   tools that generate viva questions from student submissions); they
   evaluate behind closed doors and output grades or flags; Eleza
   differs in three visible ways — questions are generated against a
   structured claim graph of the specific document rather than its
   topic, the examiner's routing rationale is rendered live during the
   viva rather than post-hoc, and the output is span-linked evidence a
   teacher adjudicates rather than a verdict. Keep it factual and
   unbranded — do not name specific competitors in the README. Match
   the existing README voice: plain, specific, no marketing tone.

3. Duration consistency: The README says "2 minutes" in the demo
   instructions while the deployment section states a 150-second
   Postgres clamp. Reconcile every duration reference: user-facing copy
   (README demo instructions AND any UI strings in the app) should say
   "about two minutes"; state the 150-second server-side clamp exactly
   once, in the deployment section, as the hard ceiling. Grep the
   codebase for "2 minutes", "two minutes", "2-minute", "120", and
   "150" to catch every instance, including page copy and the judge
   demo button label.

4. Rename "build log.md" to "BUILD_LOG.md" using git mv so history is
   preserved. Update every reference: the README link, the logging
   instruction in AGENTS.md, and any code or docs that mention the
   filename.

Then verify: npm run lint, npm test, npm run build all clean; confirm
no README link 404s by checking every relative link in the file
resolves to a real path in the repo. Commit as a single
submission-readiness commit and push. Append the build log entry for
this prompt per the standing practice.
```

Decisions and outcomes:

- Added the standard MIT license and a factual, unbranded positioning paragraph that acknowledges the existing category while distinguishing claim-graph targeting, live routing receipts, and span-linked evidence instead of verdicts.
- Standardized all deployed judge-facing duration copy to “about two minutes,” kept the 150-second hard ceiling stated once in the README deployment section, and removed numeric duration wording from user-facing limit errors while preserving implementation constants and historical prompt text.
- Renamed the log with `git mv`, updated active references to `BUILD_LOG.md`, and verified every README-relative link resolves. TypeScript, all 18 tests, and the production build pass cleanly.

## 26 — Add paste defense, honest graph controls, dossier print, and student links

Prompt:

```text
Four additions, in this priority order. Complete and verify each before
starting the next, so a partial phase still ships whole features. All
five AGENTS.md invariants apply unchanged — in particular: no verdicts
anywhere in new UI, findings vocabulary stays the three existing types,
and every new surface renders from the existing decision_log and
findings tables rather than new state.

1. Defend your own essay (paste-your-own flow)
   On the landing page, alongside the fixture demo, add "Defend your
   own writing." A textarea accepts pasted text: minimum 250 words,
   maximum 1,200 words, argumentative prose. On submit: run the
   standard claim-graph generation, show the graph inspection view for
   confirmation, then offer the same voice/text viva paths as the
   fixture flow. Sessions created this way count against the existing
   per-IP and global rate limits and the 150-second clamp — no new
   limit surface. Scope honestly in the UI: one line stating it works
   best on argumentative writing, and if graph generation yields fewer
   than 4 claim nodes, do not start a viva — explain plainly that the
   text doesn't have enough argumentative structure to examine, in the
   product's voice (no apology, no error jargon). Pasted text and its
   artifacts persist through the same tables; add a data note to the
   start screen ("Your text and transcript are stored to generate your
   dossier"). No file upload in this flow — paste only.

2. Graph editing (make the existing affordance real)
   First check whether "Looks wrong? Edit the graph" on /inspect is
   functional. If it is decorative, implement the minimal honest
   version: rename a claim's label, delete a claim node (cascade its
   edges), and adjust a claim's span by re-selecting text in the
   document column. Edits re-validate through the existing Zod span
   rules — an edited span must still resolve to real character offsets.
   Store edited graphs as a new claim_graphs row (the original is never
   mutated) with a marker distinguishing teacher-edited from generated.
   If implementing this exceeds a day of work, STOP and instead remove
   the affordance entirely — a dead button in a teacher-control product
   is worse than a missing feature. Tell me which path you took and why.

3. Dossier print/PDF export
   Add a print stylesheet for the dossier view: A4, black serif body,
   findings retain their amber labels in print, leader-line pairings
   collapse to side-by-side excerpt blocks, full transcript and decision
   log appendices included, page numbers and generation timestamp in
   the footer. A "Print dossier" action triggers the browser print
   dialog — no server-side PDF generation, no new dependencies.

4. Student dossier link
   When a viva completes, show the participant a copy-able link to
   their own dossier (an unguessable token route reading the existing
   dossier data — no auth system). One line of copy: "This is your copy
   of the evidence. Your teacher sees exactly the same document." Links
   for practice sessions don't exist because practice stores nothing —
   keep it that way.

Acceptance:
- A judge can paste a 400-word argument, confirm its graph, complete a
  voice viva about THEIR text, and receive a dossier whose findings
  reference their own sentences.
- A sub-250-word or non-argumentative paste is refused with the honest
  scope message; no viva starts, no rationed session is consumed.
- The 6th session from one IP is still refused with the pasted flow in
  the mix.
- On /inspect, either an edit produces a new validated graph version
  and the viva uses the edited version, or the edit affordance no
  longer exists — one or the other, nothing in between.
- The printed dossier is legible in black-and-white on A4 with all
  receipts intact.
- A completed viva shows a working student link; opening it in a
  private window renders the identical dossier.
- npm test, lint, build, and verify:client-secrets all clean; deployed
  to production; README's "What judges can test" section updated for
  the paste flow and student link.

Append the build log entry per standing practice, including which path
item 2 took.
```

Decisions and outcomes:

- Added a 250–1,200-word paste path that invokes the standard Sol claim-graph engine, persists through the existing submission/graph tables, and requires at least four real claim nodes before exposing the existing rate-limited viva creation path. A real 537-word paste produced and persisted a 31-node graph in browser acceptance.
- Took item 2's explicit removal path: the current `/inspect` implementation already contained no graph-edit control, and source plus browser verification confirmed no decorative “Looks wrong? Edit the graph” affordance remains. This avoids claiming an unimplemented teacher control or adding a rushed graph-version schema.
- Added dependency-free A4 browser printing with visible evidence appendices, plus an HMAC-signed participant route over the existing dossier, transcript, and decision log. The link adds no parallel evidence state and practice remains unsaved and link-free; TypeScript, all 22 tests, production build, and the 32-asset client-secret scan pass.

## 27 — Ship and verify the four participant-facing additions

Prompt:

> continue

Decisions and outcomes:

- Staged and committed only the feature, documentation, and test files, leaving the user's active `docs/eleza-prd.md`, `.DS_Store`, and `UI_design/` changes untouched; pushed commit `f425e1e` to `main`.
- Waited until Vercel served the new landing bundle, then verified production health `200`, paste-flow copy, signed student dossier receipts and appendices, malformed-token `404`, and deployed A4 print rules.
- Ran the live database limiter acceptance—attempt six was refused for sessions and Realtime tokens—then completed a production Sol paste extraction in 120 seconds with 33 nodes, 42 edges, 22 claim nodes, and persisted spans.

## 28 — Complete the final feature-freeze pass

Prompt:

```text
Phase 7 — Final pass before feature freeze

This is the last implementation prompt. Work in priority order and
complete each item fully before the next, so a partial phase still
ships whole. All five AGENTS.md invariants apply to every item — the
meta-viva and follow-up questions especially must never drift into
verdict language. After this phase the demo path is frozen: hotfixes
only.

1. Strengthen the rationale gate (claim/code gap — highest priority)
   The current quote check accepts any transcript substring ≥2
   characters, weaker than the README's "quotes the student's answer
   exactly." Tighten it: the quoted excerpt must be ≥5 words OR ≥25
   contiguous characters of the actual transcript segment. Apply to
   first attempts and retries. Add tests: a 2-character quote MUST
   fail, a 25-character contiguous quote passes, a paraphrase (right
   words, wrong order) fails. Update the README wording to state the
   enforced rule precisely.

2. Judge access code (demo-lockout risk)
   Add JUDGE_ACCESS_CODE (server env var). When supplied via query
   param or a small field on the landing page, the session bypasses
   the per-IP daily cap but counts against a separate
   JUDGE_DAILY_CAP (env var, default 50). Never expose the code in
   client bundles (extend verify:client-secrets to cover it). The
   150-second clamp still applies. Document the mechanism in the
   README deployment section without the value.

3. The meta-viva: question this decision
   Every rationale — in the live reasoning pane and in the dossier's
   decision-log appendix — gets a quiet "Question this decision"
   action. It opens a small exchange (text, 3 user turns max) where
   the examiner defends THAT specific routing choice, grounded
   strictly in: the decision-log entry, the target claim node, and
   the transcript segment it judged. Use gpt-5.6-terra with a
   versioned prompt in /prompts/meta-viva.md that requires citing the
   claim ID and quoting the decision's own rationale; if it cannot
   ground an answer in those records, it must say so plainly rather
   than confabulate. Exchanges are ephemeral — not persisted, and
   the decision log is never amended by them. Style: same green-mono
   system voice; header line: "Eleza holds itself to the standard it
   holds students to."

4. The understanding map (live coverage rendering)
   A miniature claim-graph rendering in the viva screen's corner,
   fed entirely by existing decision-log state: untouched claims
   ghosted graphite, the currently probed claim subtly pulsing,
   claims the examiner assessed as adequately defended rendered
   solid ink. No colors beyond the existing palette, no
   checkmarks, no percentages — this is coverage, not scoring, and
   the legend must say "examined / being examined / not yet
   examined," never "passed." Include the final map state as a small
   figure at the top of the dossier. Pure rendering: if any new
   state storage seems required, stop and reconsider — the decision
   log already contains everything needed.

5. Follow-up prep for teachers
   At dossier generation, for each finding produce 2–3 suggested
   in-person questions the teacher could ask that student, generated
   from the specific gap (gpt-5.6-sol, versioned prompt in
   /prompts/follow-up.md, validated to reference the finding's claim
   ID). Render as a quiet "For your conversation" block under each
   finding, in the system's mono voice. These are prompts for the
   HUMAN's conversation — the copy must never imply the student
   failed or that the questions are remedial.

6. Triage deep links + finding types inline
   Each triage row: finding count links directly to the first
   finding's anchor in the dossier (not the top), and the row shows
   finding types inline in graphite mono (e.g. "2 mechanism_gap,
   1 inconsistency"), amber only when nonzero as already established.

7. Demo-clamp framing (copy)
   One README line and one line on the viva start screen: real vivas
   are teacher-configurable at 5–8 minutes; the hosted demo is
   capped at ~2 minutes as a public-cost control. The clamp is a
   deployment setting, not the assessment design.

8. Tagline alignment (copy)
   Replace "Students can fake the essay. Not the conversation."
   everywhere it appears (landing hero, README, any meta tags) with:
   "An essay can't tell you what a student understands. A
   conversation can." Grep for the old line to catch every instance.

9. The declined feature, documented
   We considered and REJECTED storing audio recordings of vivas for
   replay of findings (hearing the student's actual hesitation).
   Rejected because retaining student voice recordings is
   surveillance-weight infrastructure that contradicts the product's
   privacy posture; transcripts with timestamps carry the evidentiary
   value without the biometric residue. Record this as a
   // DECISION: comment at the top of src/lib/dossier-store.ts, a
   build-log entry, and one sentence in the README's invariants
   section ("What Eleza deliberately does not do: ... retain audio
   recordings"). Do not implement any audio storage.

10. Hygiene
    git mv "Live Viva Room.dc.html" and any other design reference
    files into design/; resolve Agents.md vs AGENTS.md to a single
    canonical AGENTS.md (preserve content, update every reference);
    verify no README relative link 404s afterward.

Acceptance:
- Gate tests pass including the new failure cases; README matches the
  enforced rule.
- With the judge code, a 6th session from one IP succeeds; without
  it, refused; the code appears nowhere in built client assets.
- During a live viva: the understanding map fills as decisions land,
  and clicking any rationale opens a grounded meta-viva exchange that
  cites the claim ID; asking it something outside the records gets an
  honest refusal, not invention.
- A dossier shows the final map, per-finding "For your conversation"
  blocks referencing correct claim IDs, and its decision-log entries
  are questionable via the same meta-viva surface.
- Triage counts deep-link to finding anchors and show inline types.
- Old tagline: zero occurrences repo-wide. New tagline present on
  landing and README.
- npm test, lint, build, verify:client-secrets clean; deployed;
  README's judge-testing section updated for the meta-viva, map, and
  judge code (mechanism only).

Append the build log entry per standing practice. After this deploys
and I verify the checklist against production, the demo path is
frozen.
```

Decisions and outcomes:

- Enforced rationale receipts as exact transcript substrings of at least five words or 25 contiguous characters on every examiner attempt, with boundary and wrong-order tests proving short or paraphrased excerpts cannot pass.
- Kept the judge bypass server-side and auditable: a constant-time checked access code selects a separate daily tier while the 150-second clamp remains unchanged; meta-viva exchanges remain ephemeral and all coverage UI derives only from the existing claim graph and append-only decision log.
- Rejected audio retention and documented why: timestamped transcripts preserve the evidentiary receipt without retaining biometric voice data. Added Sol-generated, claim-bound teacher follow-ups to the existing dossier analysis record, then consolidated design references under `design/` and the build instructions under canonical `AGENTS.md`.

## 29 — Extract the essay domain into a behavior-preserving profile

Prompt:

```text
Phase 8A  Domain profile system (pure refactor; zero behavior change)

Extract the implicit essay domain into an explicit profile system.

1. Create profiles/essay.ts defining: artifact_noun, node_types
   (claim/evidence/citation), edge_types (supports/rebuts/depends_on),
   probe_framing block (current examiner framing, verbatim),
   dossier_vocab ("claims defended"), and fixture reference.
2. Parameterize the graph prompt: one base template in
   /prompts/claim-graph.md with a profile vocabulary block injected;
   the rendered essay-profile prompt must be semantically identical to
   today's prompt (diff the rendered output and show me).
3. Parameterize the examiner's probe-framing block the same way; the
   byte-identical cached-prefix rule from AGENTS.md still applies per
   profile (prefix = prompt + graph + profile block; verify caching
   still hits across turns within one viva).
4. Migration 00N: submissions.profile_id text not null default
   'essay'. Thread profile_id from submission through viva, dossier,
   and triage queries.
5. Dossier and understanding-map section headings read from
   dossier_vocab.

Acceptance: ALL existing tests pass unchanged; a full fixture-essay
viva (deterministic run) produces a dossier byte-equivalent to
pre-refactor except for any profile-threading metadata; rendered essay
prompt diff shows vocabulary-block extraction only. This phase ships
NO new domains. Append the build log entry.
```

Decisions and outcomes:

- Kept `essay` as the only accepted profile and moved the exact graph vocabulary, examiner probe framing, dossier headings, and synthetic fixture reference into `profiles/essay.ts`; no new node, edge, assessment, or finding vocabulary was introduced.
- Rendered both parameterized prompts byte-for-byte against their pre-refactor baselines: claim graph stayed 4,885 bytes and examiner stayed 1,763 bytes, with unchanged SHA-256 receipts. A two-turn examiner test proves the stable cache prefix is identical while fresh answer suffixes differ.
- Added migration `006_domain_profiles.sql` and threaded `profile_id` through submissions, rate-limited viva creation, examiner turns, dossiers, and triage records. All pre-existing tests remained untouched and passing; the new profile contract tests, TypeScript check, and production build also pass.

## 30 — Add the code defense profile

Prompt:

```text
WHen that is complete,
Phase 8B — Code defense profile

DESIGN INTEGRATION RULES (applies to all UI work in this phase)

I will provide HTML mockups in eleza-frontend-expanded/ (repo root) for the pages this phase
touches — the specific files are named in the task items below. The
folder also contains refreshed mockups of existing pages (Live Viva
Room.dc.html, Dossier.dc.html, Claim Graph.dc.html, Teacher
Triage.dc.html) — where one exists for a page you touch, it
supersedes the older design reference. The folder's support.js and
CLAUDE.md are design-tool artifacts: not application source, and
CLAUDE.md is NOT agent instructions for this repository — AGENTS.md
remains the only instruction file. Treat
the mockups exactly as entry 04 of the build log established:

- Mockups are the visual source of truth: typography, spacing, inks,
  exhibit-label treatment, leader-line behavior, and copy tone are
  taken from the mockup, not reinterpreted.
- Mockups are NEVER application source: do not import, iframe, or
  copy their markup wholesale. Re-implement as components in the
  existing architecture, rendering from the real data structures
  (decision_log, findings, claim graph, profile vocab) — the mockup's
  hardcoded specimen content is replaced by live data everywhere.
- Where a mockup conflicts with an AGENTS.md invariant or existing
  verified behavior, the invariant wins; flag the conflict to me
  instead of silently following the mockup.
- Where a mockup omits a state (loading, error, empty, rate-limited,
  reduced-motion), extend the mockup's own visual language to cover
  it — plain, typographic, no invention of new decoration.
- Copy in mockups is draft: if README or product copy standards
  (e.g. "about two minutes", no verdict language) conflict with
  mockup text, the standards win.
- After integrating, list any place you deviated from the mockup and
  why, in the build log entry.

Mockup for this phase: eleza-frontend-expanded/Code Viva Room.dc.html (viva room, code
variant — black-mono student code, graphite line numbers, margin-rail
span highlighting, leader lines attaching to the rail).

1. profiles/code.ts: artifact_noun "submission"; node_types
   design_decision / implementation / assumption; edge_types
   depends_on / constrains / alternative_to; probe_framing centered on
   justification and failure modes ("why this structure," "what breaks
   if X," "what alternative did you reject"); dossier_vocab "decisions
   defended".
2. Fixture: write fixtures/code-inventory-tracker.py (or .ts — pick
   one mainstream teaching language), ~80 lines, an intro-SWE
   inventory/roster style assignment. Deliberate weak spot: one
   data-structure choice that works but is never justified and fails
   on a specific input class (document the intended weak spot in a
   fixture README so acceptance is checkable). Code must be original,
   synthetic, and idiomatic student-level work.
3. Graph generation for code: nodes must still resolve to real
   character offsets (function/branch spans). Verify the existing span
   validator handles code text unchanged.
4. Viva screen: when profile is code, integrate
   eleza-frontend-expanded/Code Viva Room.dc.html per the design integration rules — the
   document column renders live fixture code from the real graph
   spans, not the mockup's specimen code; indentation, line numbers,
   and margin-rail highlighting follow the mockup exactly.
5. Landing: second card "Defend this code" using the same session
   budget and clamps.

Acceptance: a deterministic viva on the code fixture routes only to
graph nodes; a scripted weak defense of the unjustified decision
yields exactly one cannot_reconstruct or mechanism_gap finding on the
documented weak-spot span and zero findings on well-defended
decisions; rationale gate operates unchanged (quotes from spoken
answers about code pass the ≥5-word/≥25-char rule); dossier reads
"decisions defended." Append the build log entry.
```

Decisions and outcomes:

- Added `profiles/code.ts` without creating a parallel assessment system: code has its own strict node/edge vocabulary and failure-mode probe framing, while questions, rationale gating, append-only decisions, divergence types, persistence, limits, and dossier storage remain shared. The essay prompt-byte and cache-prefix tests still pass; the code prefix is also byte-identical across turns.
- Chose an original 92-line introductory Python inventory tracker whose name-keyed dictionary silently overwrites different SKUs sharing one display name. The deterministic graph anchors that choice and its assumption to real offsets; the scripted weak defense yields exactly one `mechanism_gap` on that span, three strong decisions remain finding-free, and all examiner questions target only `design_decision` nodes.
- Reimplemented the supplied code-room language with live data: black JetBrains Mono source, graphite line numbers, a 3px graph-span rail, measured rail-to-decision leader lines, reduced-motion behavior, and code receipts in the dossier. Deliberate mockup deviations: kept the established “about two minutes” copy instead of “2-minute”; exposed only the shipped Essay and Code cards rather than the mockup's unimplemented Lab report and Case analysis profiles; retained the understanding map, meta-viva, explicit Finish answer/end controls, data disclosure, print action, and student link because they are verified product behavior or architecture receipts omitted from the static specimen. A read-only production schema check found migrations 005 and 006 unapplied, so the verified local commit was intentionally not pushed into a deployment that would fail its session and dossier queries.

## 31 — Add lab-report and case-analysis profiles and expose all four domains

Prompt:

```text
Phase 8C — Lab report and case analysis profiles; four-domain surface

DESIGN INTEGRATION RULES (applies to all UI work in this phase)

I will provide HTML mockups in eleza-frontend-expanded/ (repo root) for the pages this phase
touches — the specific files are named in the task items below. The
folder also contains refreshed mockups of existing pages (Live Viva
Room.dc.html, Dossier.dc.html, Claim Graph.dc.html, Teacher
Triage.dc.html) — where one exists for a page you touch, it
supersedes the older design reference. The folder's support.js and
CLAUDE.md are design-tool artifacts: not application source, and
CLAUDE.md is NOT agent instructions for this repository — AGENTS.md
remains the only instruction file. Treat
the mockups exactly as entry 04 of the build log established:

- Mockups are the visual source of truth: typography, spacing, inks,
  exhibit-label treatment, leader-line behavior, and copy tone are
  taken from the mockup, not reinterpreted.
- Mockups are NEVER application source: do not import, iframe, or
  copy their markup wholesale. Re-implement as components in the
  existing architecture, rendering from the real data structures
  (decision_log, findings, claim graph, profile vocab) — the mockup's
  hardcoded specimen content is replaced by live data everywhere.
- Where a mockup conflicts with an AGENTS.md invariant or existing
  verified behavior, the invariant wins; flag the conflict to me
  instead of silently following the mockup.
- Where a mockup omits a state (loading, error, empty, rate-limited,
  reduced-motion), extend the mockup's own visual language to cover
  it — plain, typographic, no invention of new decoration.
- Copy in mockups is draft: if README or product copy standards
  (e.g. "about two minutes", no verdict language) conflict with
  mockup text, the standards win.
- After integrating, list any place you deviated from the mockup and
  why, in the build log entry.

Mockups for this phase: eleza-frontend-expanded/Judge Demo Landing.dc.html (landing
with four artifact cards) and eleza-frontend-expanded/Code Dossier.dc.html
together with Dossier.dc.html (per-domain dossier vocabulary — the
Dossier file governs prose domains, Code Dossier governs the code
ink treatment). Note the landing mockup's
specimen marginalia are illustrative copy — the deployed hero keeps
them as a static annotated specimen ONLY if clearly presented as one;
any surface labeled or implied live must render from real data.

1. profiles/lab-report.ts: node_types hypothesis / method_choice /
   interpretation / conclusion; edge_types supports / tests /
   depends_on; probe_framing on evidentiary discipline ("why does this
   result support that interpretation," "what outcome would have
   falsified the hypothesis," "why this control"); dossier_vocab
   "interpretations defended".
2. profiles/case-analysis.ts: node_types recommendation / assumption /
   tradeoff / rejected_alternative; edge_types supports / undermines /
   depends_on; probe_framing on assumption stress ("which assumption,
   if wrong, breaks the recommendation"); dossier_vocab "assumptions
   defended".
3. Fixtures: fixtures/lab-photosynthesis-report.txt (~1 page; weak
   spot: the conclusion overreaches one specific result — document it)
   and fixtures/case-expansion-memo.txt (~1 page; weak spot: an
   unstated assumption the recommendation depends on — document it).
   Synthetic, original, no real company or institution names.
4. Landing becomes four artifact cards per
   eleza-frontend-expanded/Judge Demo Landing.dc.html, integrated under the design
   rules; the essay card retains the paste-your-own path; the three
   new cards are fixture-only, stated plainly on each card. Apply
   product copy standards over mockup copy where they differ
   ("about 2 minutes"; examiner marginalia must describe what the
   examiner actually does — no external-verification or
   verdict-toned phrasing).
4b. Dossier per-domain vocabulary integrates
   eleza-frontend-expanded/Code Dossier.dc.html; findings render artifact
   excerpts in the correct ink (black mono + margin rail for code,
   serif for prose) from real finding spans.
5. README: replace the single-fixture framing with a "Domain profiles"
   section — the engine is domain-parameterized; profiles define node
   vocabulary, edge semantics, and probe framing; the invariants,
   divergence types, and gates are universal. List the four profiles
   and each fixture's documented weak spot so judges can test
   acceptance themselves.
6. Triage shows the profile per row (graphite mono label).

Acceptance: all four fixtures complete deterministic vivas; each new
fixture's scripted weak defense produces a finding on its documented
weak-spot span and none elsewhere; understanding map and meta-viva
work unchanged on all profiles; per-profile dossier vocabulary
correct; the 5/IP + judge-code + global limits apply across all
cards from one shared budget; full offline suite, build, and
client-secret scan clean; deployed and production-verified; the build
log entry lists every deviation from the mockups and why. THEN the
freeze is real: video and submission only.
```

Decisions and outcomes:

- Added strict `lab_report` and `case_analysis` profile contracts while keeping one universal examiner, rationale gate, decision log, divergence vocabulary, understanding map, meta-viva, persistence path, and rate-limited session endpoint. Examinable node types are explicit per profile so essay and code retain their prior routing behavior while every lab and case node can be defended; the stable prompt-plus-graph prefix remains byte-identical across turns.
- Added original 443-word photosynthesis and 413-word cooperative-expansion fixtures with exact-offset deterministic graphs. Scripted weak defenses produce exactly one `mechanism_gap` on the lab's universal sole-factor conclusion and exactly one `cannot_reconstruct` on the case schedule's implied spare-volunteer assumption; strongly defended nodes receive no findings. All 54 offline tests, TypeScript, production build, and the 33-asset client-secret scan pass.
- Reimplemented the four-card exhibit grid, profile dossier labels/source inks, and graphite triage labels from real profile, graph, decision-log, and findings data. Deliberate mockup deviations: retained “about two minutes” instead of the mockup's “2-minute” copy; did not reproduce the illustrative mid-viva marginalia because its citation-verification wording exceeds Eleza's content-reconstruction scope and a static panel labeled live would misrepresent hardcoded content; kept the existing real fixture essay/action area, paste/practice paths, understanding map, meta-viva, explicit turn controls, disclosures, print action, and student link because they are shipped behavior omitted from the specimens; added card actions because fixture-only cards must actually start their domain flow; and rejected the prose dossier mockup's extra finding label because findings remain exactly `cannot_reconstruct`, `mechanism_gap`, or `inconsistency`. Desktop and 390px browser checks show the four-card grid without overflow and a lab card handoff with all eight graph nodes. Production deployment remains intentionally blocked until migrations 005 and 006 are applied to the configured Supabase project.
