# Eleza

Eleza is a transparent oral-defense tool for argumentative writing. It parses a submission into claim spans, conducts an examiner-routed viva, and returns a dossier of transcript-to-document receipts. It does not produce authenticity scores, pass/fail labels, or verdicts.

Eleza improves on existing oral-assessment concepts rather than claiming to create the category. Research deployments and commercial tools already generate viva questions from student submissions, but their evaluation is generally hidden and returned as grades or flags. Eleza instead targets a structured claim graph of the specific document and renders the examiner's routing rationale live during the viva. Its dossier returns span-linked evidence for a teacher to adjudicate instead of a verdict.

**Hosted judge demo:** [https://eleza-drab.vercel.app](https://eleza-drab.vercel.app)

## What judges can test

The zero-login demo starts with a synthetic 537-word essay and supports four paths:

1. **Voice viva:** select **Defend this essay — about two minutes**, grant microphone access, answer aloud, and press **Finish answer** after each response. The transcript and examiner routing receipts appear live; a dossier is generated when the session ends.
2. **Text accessibility mode:** select **Use typed answers instead**. Typed responses pass through the same examiner, decision log, divergence analysis, and dossier path as voice responses.
3. **Unrecorded practice:** select **Try an unrecorded warm-up** for a second synthetic essay. Practice creates no saved transcript, decisions, or dossier.
4. **Defend your own writing:** paste 250–1,200 words of argumentative prose, confirm the generated claim graph, then choose the same voice or typed viva. Text without at least four claim nodes is stopped before session creation, so it does not consume the daily allowance.

Completed recorded vivas open an unguessable student dossier link that can be copied and opened in a private window; it renders the same evidence document available to the teacher. Dossiers can also be printed from the browser with their transcript and decision-log appendices intact. The claim-graph upload and inspection flow is available at [`/inspect`](https://eleza-drab.vercel.app/inspect), and the findings-sorted teacher dossier list is at [`/triage`](https://eleza-drab.vercel.app/triage). Public session creation is limited to five sessions per IP digest per UTC day, so judges sharing one network should use the existing demo deliberately.

## Architecture

Eleza is three connected systems:

1. **Claim graph engine:** server-side `.txt` and `.pdf` extraction followed by structured claim, evidence, citation, and dependency generation. Every node must resolve to real character offsets in the submitted document.
2. **Live viva:** the Realtime voice model speaks, while a separate GPT-5.6 examiner evaluates each completed answer and chooses `probe`, `branch`, or `advance`. Every accepted decision is appended to one decision log used by both the live reasoning pane and the dossier.
3. **Post-viva divergence analysis:** the transcript is compared with graph-owned document spans for only `cannot_reconstruct`, `mechanism_gap`, or `inconsistency`. The dossier links each finding's timestamp, answer excerpt, claim, and exact document span.

The architecture has five non-negotiable invariants:

- The Realtime voice model speaks externally routed questions; the GPT-5.6 examiner chooses every next move.
- Every examiner decision is one append-only log entry rendered by both the live pane and dossier.
- A rationale is rejected unless it cites the target claim ID and quotes the student's answer exactly.
- Divergence analysis is content-reconstruction only; written-versus-spoken register comparison is excluded for bias reasons.
- Eleza presents evidence, never an authenticity score or verdict. Humans decide.

## Building with Codex

This repository was built in one primary Codex collaboration. The append-only [build log](./BUILD_LOG.md) preserves each user prompt and the two or three consequential choices made after it; the Git history keeps each working checkpoint inspectable.

### What Codex built

Codex implemented the application in acceptance-tested slices rather than scaffolding all three systems at once:

| Slice | Delivered behavior | Main commits |
|---|---|---|
| Claim graph | Text/PDF upload, server extraction, GPT structured graph generation, span validation, Supabase persistence, and document-first inspection | `514d53c`, `cbb3df1` |
| Live viva | Realtime question delivery, timestamped transcript, pure examiner, rationale gate, deterministic bridge pipeline, append-only decisions, and live reasoning pane | `801546c`, `b725804`, `ebf8e52`, `2c20ab8` |
| Dossier | Three-type divergence analysis, semantic receipt validation, persisted dossiers, timestamp-to-document links, and evidence appendices | `c4fcfba`, `fa24e8d` |
| Judge flow | Zero-login fixture demo, unrecorded practice, typed fallback, teacher triage, rate limits, and Vercel deployment | `4253a2a`, `09c9243` |
| Voice hardening | Minimum-lifetime client tokens, explicit answer commits, Safari-safe playback, and peer/ICE diagnostics | `347870e`, `340857a` |

The complete chronological Git record harvested for this narrative is:

| Commit | What changed |
|---|---|
| `514d53c` | Added claim-graph upload and inspection |
| `cbb3df1` | Verified deterministic extraction and span receipts |
| `801546c` | Built the Realtime viva and examiner loop |
| `b725804` | Wired examiner decisions into the live voice pipeline |
| `ebf8e52` | Added the real-provider viva acceptance harness |
| `1c457f4` | Established the Codex decision log |
| `213d2b0` | Recorded the manual handoff requirements |
| `3143df9` | Documented the Supabase migration dependency |
| `2c20ab8` | Enforced exact Realtime question delivery |
| `c4fcfba` | Built post-viva divergence dossiers |
| `fa24e8d` | Recorded stored dossier acceptance |
| `4253a2a` | Built the zero-login judge demo |
| `09c9243` | Hardened the demo for production |
| `347870e` | Verified minimum-lifetime Realtime tokens |
| `340857a` | Added explicit voice turn completion |

Every non-obvious `// DECISION:` receipt currently in the implementation is reflected below:

| Source | Decision and reason |
|---|---|
| [`src/lib/generate-claim-graph.ts`](./src/lib/generate-claim-graph.ts) | Keep a deterministic local graph path so the curated judge demo remains inspectable without credentials. |
| [`src/lib/examiner.ts`](./src/lib/examiner.ts) | Keep the prompt and graph as a byte-identical cached prefix; only the latest answer is fresh input. |
| [`src/lib/viva-pipeline.ts`](./src/lib/viva-pipeline.ts) | Precompute deterministic bridge questions so latency never grants routing authority to the voice model. |
| [`src/app/api/viva/turn/route.ts`](./src/app/api/viva/turn/route.ts) | Persist an accepted examiner decision before exposing it to the UI, preventing parallel reasoning state. |
| [`src/lib/divergence.ts`](./src/lib/divergence.ts) | Send source evidence once and return compact classifications; transcript and decision records remain canonical. |
| [`src/lib/dossier-store.ts`](./src/lib/dossier-store.ts) | Ignore duplicate sequence receipts so a failed dossier request can be retried without rewriting transcript history. |
| [`src/lib/rate-limit.ts`](./src/lib/rate-limit.ts) | Store only a service-key-salted IP digest; raw visitor IP addresses never enter Postgres. |
| [`src/app/api/realtime/token/route.ts`](./src/app/api/realtime/token/route.ts) | Explicitly request OpenAI's supported 10-second client-token minimum instead of accepting the longer default. |
| [`src/app/api/realtime/token/route.ts`](./src/app/api/realtime/token/route.ts) | Disable VAD so thoughtful pauses are preserved and one explicit student action defines each examiner answer. |
| [`src/app/viva/page.tsx`](./src/app/viva/page.tsx) | Make the **Finish answer** commit—not a pause detector—the answer boundary. |
| [`src/app/viva/page.tsx`](./src/app/viva/page.tsx) | Deliver one externally routed question with empty model input so the voice layer cannot freelance. |
| [`src/app/viva/page.tsx`](./src/app/viva/page.tsx) | Handle Safari track events with a fallback `MediaStream` and explicit audio playback. |
| [`src/app/viva/page.tsx`](./src/app/viva/page.tsx) | Exchange SDP directly from the browser using an ephemeral token; audio never crosses the app server. |
| [`src/lib/student-dossier-token.ts`](./src/lib/student-dossier-token.ts) | Sign the existing dossier ID instead of persisting a second access record, keeping evidence canonical while making the participant route unguessable. |

### Where I overrode it and why

The human contribution was not a final polish pass; it set the product's consequential boundaries and corrected interaction choices as the demo became real:

- **Architecture and model authority:** I required “the voice model talks; the examiner decides,” one append-only decision log, a schema-level rationale gate, no register comparison, and no verdicts. These constraints prevent a fast implementation from quietly turning into an opaque AI grader.
- **Visual direction:** I supplied the first HTML reference and later the `UI_design` pages. I rejected a physics-simulation node cloud in favor of a manuscript-like, document-first claim index, and rejected dashboard decoration in favor of a quiet teacher triage table. The reason was evidentiary clarity: the essay and receipts must remain primary.
- **Turn completion:** the first voice implementation used semantic pause detection. After using it, I asked for a student-controlled end-turn button. Codex replaced VAD boundaries with **Finish answer** so a student can pause to think without prematurely triggering the examiner.
- **Operational authority:** Codex wrote migrations, deployment configuration, and verification scripts, but I applied the Supabase migrations and supplied dashboard secrets. Those operations remain human-controlled because Codex should not assume authority over external credentials or production accounts.

The build log also records corrections discovered through live acceptance: an unsupported GPT-5.6 `temperature` parameter was removed after a real call, and an early Realtime instruction that could answer its own question was replaced with the versioned exact-delivery template in [`prompts/realtime-question.md`](./prompts/realtime-question.md).

### How GPT-5.6 is used in each of the three systems

Model routing is centralized in [`src/lib/models.ts`](./src/lib/models.ts); Luna is deliberately unused.

| System | Model | Use |
|---|---|---|
| Claim graph engine | `gpt-5.6-sol` | Runs once per submission with [`prompts/claim-graph.md`](./prompts/claim-graph.md). Strict structured output produces claim/evidence/citation nodes and `supports`/`rebuts`/`depends_on` edges; Zod then validates IDs and real character spans before persistence. Sol is used because every downstream question inherits the graph's granularity. |
| Live viva examiner | `gpt-5.6-terra`, with `gpt-5.6-sol` for gate retries | Receives a stable prompt-plus-graph prefix and the latest completed answer as a fresh suffix. It emits the answer summary, assessment, action, target claim, next claim, next question, and rationale. Dynamic Zod validation rejects any rationale that omits the claim ID or an exact answer quote, and rejects invalid probe/branch/advance routing. The separate `gpt-realtime-2.1` session only voices the routed question. |
| Post-viva divergence | `gpt-5.6-sol` | Runs asynchronously with [`prompts/divergence.md`](./prompts/divergence.md) after the viva. It classifies content-reconstruction differences into exactly three allowed types and returns timestamp/excerpt/claim/span receipts. Semantic validation rejects invented timestamps, excerpts, claim IDs, or document spans before dossier persistence. |

## Local setup

Requirements:

- Node.js 20 or newer
- An OpenAI API key with access to the configured models
- A Supabase project

```bash
git clone https://github.com/Jeremiah-Sakuda/Eleza.git
cd Eleza
npm install
cp .env.example .env.local
```

Apply every SQL file in [`supabase/migrations`](./supabase/migrations) in filename order using the Supabase SQL Editor:

1. `001_claim_graphs.sql`
2. `002_live_viva.sql`
3. `003_dossiers.sql`
4. `004_demo_rate_limits.sql`

Then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use `/inspect` for upload and graph inspection, `/viva` through a generated handoff, and `/triage` for completed dossiers.

## Environment variables

Copy [`.env.example`](./.env.example) to `.env.local`. `.env.local` is gitignored.

| Variable | Required | Exposure | Purpose |
|---|---:|---|---|
| `OPENAI_API_KEY` | Yes | Server only | Responses API calls and minting ephemeral Realtime client tokens. Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public configuration | Identifies the Supabase project. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Server persistence, RPC rate limiting, health checks, and the salt used for privacy-preserving IP hashes. |
| `DEMO_GLOBAL_DAILY_CAP` | No | Server configuration | Global daily session/token capacity; defaults to `200`. |

```dotenv
OPENAI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DEMO_GLOBAL_DAILY_CAP=200
```

## Sample data

All repository samples are synthetic; no real student work or institution names are used.

- [`fixtures/community-gardens-argument.txt`](./fixtures/community-gardens-argument.txt): primary 537-word argumentative judge essay with a deterministic eight-claim graph.
- [`fixtures/practice-transit-argument.txt`](./fixtures/practice-transit-argument.txt): separate unrecorded warm-up essay.
- [`fixtures/examiner`](./fixtures/examiner): five canned answers—strong, restated conclusion, contradictory, evasive, and off-topic—for examiner gate and routing tests.
- [`fixtures/divergence/weak-viva.json`](./fixtures/divergence/weak-viva.json): deliberately weak paragraph-three defense used to verify one exact `cannot_reconstruct` receipt and no findings on defended claims.
- [`fixtures/viva-answers.json`](./fixtures/viva-answers.json): deterministic answers for wired-viva acceptance runs.

## Testing

The offline verification path is safe for a fresh clone after `npm install`:

```bash
npm test
npm run lint
npm run build
npm run verify:client-secrets
```

- `npm test` covers examiner rationale/routing gates, all five canned answer classes, divergence receipts, pasted-text boundaries and graph scope, signed student dossier links, rate-limit IP handling, explicit Realtime audio commits, the hardcoded three-minute transport, and three deterministic five-minute pipeline runs.
- `npm run lint` runs TypeScript without emitting files.
- `npm run build` performs the production Next.js build.
- `npm run verify:client-secrets` scans built browser assets for the configured server secret values.

With valid `.env.local` credentials and applied migrations, provider-backed acceptance is available:

```bash
npm run verify:viva
npm run verify:dossier
npm run verify:dossier:stored
npm run verify:rate-limit
npm run verify:realtime-token
```

To exercise the upload endpoint twice against the primary fixture, keep `npm run dev` running in another terminal and run `npm run verify:fixture`. This checks extraction, at least six claim nodes, real spans, and repeat structure through the HTTP route.

All acceptance commands use only synthetic fixtures. The viva, stored-dossier, rate-limit, and token checks create test records in the configured Supabase project; use a development project when reproducing them.

### Hosted acceptance checklist for judges

- Open the HTTPS URL in current Chrome or Safari on a desktop or phone.
- Start the voice demo, grant microphone access, answer one question, and press **Finish answer**.
- Confirm the student transcript appears, the next spoken question traces to a claim, and a specific rationale appears in the right-hand pane.
- Let the session run for about two minutes or end it early, then inspect the dossier's defended claims, findings, full transcript, and full decision log.
- Copy the student dossier link and open it in a private window; confirm it renders the same receipts. Use **Print dossier** and inspect the A4 preview, including both appendices.
- Repeat through **Use typed answers instead** and confirm the same dossier structure.
- Paste a 400-word argument under **Defend your own writing**, confirm its graph, and complete a viva whose questions and dossier spans refer to that text. Confirm a sub-250-word paste is stopped before graph or session creation.
- Open `/triage` and confirm completed vivas are sorted by finding count without turning zero findings into a positive verdict.

## Production deployment on Vercel

1. Create a Supabase project and apply all four migrations in order.
2. Import or link the repository in Vercel.
3. Add the four variables above to Production; add them to Preview and Development if those deployments should be functional. Mark the OpenAI and service-role values sensitive.
4. Set an OpenAI project spend cap appropriate for the public demo.
5. Deploy, then verify:

   ```bash
   curl -i https://YOUR_DOMAIN/api/health
   ```

The browser obtains a rate-authorized, short-lived client token from `/api/realtime/token`, then exchanges WebRTC SDP and audio directly with OpenAI. The standard OpenAI key never enters a client response or bundle. Session and token creation are atomically limited in Supabase to five attempts per salted IP digest per UTC day and a configurable global daily cap. Judge sessions are clamped to 150 seconds in Postgres and checked again before examiner turns.

[`vercel.json`](./vercel.json) registers a daily `/api/health` cron that performs a trivial Supabase read. Production acceptance should include a `200` health response, Chrome and Safari microphone permission on the HTTPS domain, one desktop and one physical phone, a complete voice viva, a complete typed viva, and confirmation that attempt six from one connection receives HTTP `429` with the next UTC retry time.

## License

Eleza is available under the [MIT License](./LICENSE).
