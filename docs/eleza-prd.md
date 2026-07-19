# Eleza — PRD
*Original planning document, preserved as authored. The [README](../README.md) documents the shipped system.*

**OpenAI Build Week 2026 · Education Track · Submission deadline: July 21, 5:00 PM PT**

*Eleza (Swahili): to explain. The instruction at the heart of the product — explain your work.*

---

## 1. One-liner

An essay can't tell you what a student understands. A conversation can. Eleza conducts a live voice oral defense of submitted work — with a transparent examiner that shows its reasoning in real time — and produces an evidence dossier instead of a verdict.

## 2. Problem

AI detection is dead. False-positive rates are unacceptable and systematically biased against non-native English speakers, while LLM-generated text is now indistinguishable from human writing even to expert raters. Institutions are responding with oral examination — the one format where understanding must be performed live — but human-administered vivas don't scale (roughly 30 combined instructor hours per 36 students) and existing AI viva tools are black boxes: they grade behind closed doors, output scores teachers must defend to parents and appeals boards, and offer no visibility into why the examiner asked what it asked.

An assessment tool that adjudicates academic integrity must itself be auditable. None of the incumbents are.

## 3. Positioning

The category exists. Do not claim otherwise anywhere in the submission — the honest frame is "improves on existing concepts," which is what the Quality of Idea criterion explicitly asks.

| Incumbent | What it does | What it lacks |
|---|---|---|
| Sherpa (Sherpa Labs, Stanford) | Adaptive questioning on submissions via Depth of Knowledge framework; flags issues for teacher review | Post-hoc flags; no live examiner reasoning; no structural anchoring to the document's argument |
| "Viva" (arXiv 2603.18221, NYU Stern, Mar 2026) | Voice exam pipeline; 3-LLM grading panel with chair synthesis; human audit routing | Grades behind closed doors; outputs a grade; own paper concedes constraints must be architectural, not prompted |
| VivaMQ (Macquarie) | Viva question generation from submissions; rubric tooling | No live adaptive voice; no transparency layer |
| Socratic Mind (ACM L@S) | Scalable chat-based oral assessment, 600-student deployment | Chat, not voice; opaque evaluation |

### The three differentiators (lead every artifact with these)

1. **Claim graph anchoring.** The submission is parsed into a structured graph of claims, evidence, and logical dependencies. Questions are generated against specific nodes and edges — "you rejected the counterexample in ¶3; walk me through why" — not against the topic. Incumbents inject context; Eleza targets structure.
2. **The transparent examiner.** A parallel model evaluates each answer against its target claim in real time and decides the next move (probe / branch / advance), with its reasoning rendered live: *"answer restated the text without explaining the mechanism → probing."* The examiner shows its work. No incumbent does this, and the arXiv paper's own failure analysis argues for exactly this architecture.
3. **Receipts, not verdicts.** Output is a dossier: claims defended, gaps flagged, each finding linking a transcript timestamp to a document span. No authenticity score. Teachers get evidence to adjudicate, not a number to defend — which also preempts the validity and bias objections that kill verdict-based tools.

## 4. Track and judging map

**Track:** Education. Rationale: structurally thinner field than Work & Productivity or Apps for Your Life; dedicated senior judge (Leah Belsky, VP of Education); the product operationalizes OpenAI's own public position that detection fails and assessment must change.

| Criterion | Eleza's answer |
|---|---|
| Technological Implementation | Three-system architecture (claim graph engine + realtime voice + parallel examiner with structured eval) + divergence analysis. Non-trivial routing between systems, all in-repo, zero external infra dependencies. Positioned to compete on the first-listed tiebreaker criterion; the README's Codex narrative carries equal weight here and must be substantive. |
| Design | Complete loop: upload → viva → dossier → teacher triage view. Practice mode and accommodations note ship in v1. Judge-testable browser demo requires zero setup. |
| Potential Impact | Named audience (teachers adjudicating AI-suspected work; institutions replacing detection), validated by a March 2026 arXiv deployment and surging misconduct-case volume. Specific mechanism: makes written work verifiable at scale. |
| Quality of Idea | Honest "improves on existing concepts" story anchored on the three differentiators, each visible on screen within the 3-minute video. |

## 5. Users and flows

**Teacher (primary).**
1. Creates an assignment (paste prompt or upload PDF/docx).
2. Students submit work; each submission is parsed into its claim graph (teacher can inspect it).
3. Configures viva: duration (5–8 min default), focus areas, accommodations (extended time, text-mode fallback).
4. Reviews class dashboard: one dossier per student, attention drawn to high-divergence cases.

**Student.**
1. Opens viva link; sees a plain-language explainer of what will happen and what is logged.
2. Optional practice mode: a 2-minute warm-up viva on a sample text, unrecorded.
3. Takes the viva: voice conversation, questions anchored to their own submission, adaptive follow-ups.
4. Receives their own dossier copy (transparency is bidirectional).

**Judge (the flow that wins).**
1. Opens the hosted demo, no login.
2. Reads a provided 500-word sample essay (or pastes their own text).
3. Defends it in a 2-minute voice viva — while the examiner's reasoning pane updates live beside the transcript.
4. Receives their dossier 10 seconds after the last answer.

This third flow is a launch requirement, not a stretch goal. Judges may never test anything; when one does, this is the most memorable artifact either track offers.

## 6. System architecture

```
[Submission: PDF/docx/txt]
        │
        ▼
┌─────────────────────┐
│  1. CLAIM GRAPH      │  GPT-5.6 structured output → nodes (claims,
│     ENGINE           │  evidence, citations) + edges (supports,
│  (pre-viva, async)   │  rebuts, depends-on). Stored as JSON;
└─────────┬───────────┘  rendered as an inspectable graph.
          │
          ▼
┌─────────────────────┐     ┌──────────────────────┐
│  2a. VOICE SESSION   │◄───►│  2b. PARALLEL         │
│  Realtime API        │     │  EXAMINER (GPT-5.6)   │
│  Conducts the        │     │  Scores each answer   │
│  conversation        │     │  vs. target node;     │
│                      │     │  emits {decision,     │
│                      │     │  rationale, next_node}│
└─────────┬───────────┘     └──────────┬───────────┘
          │        examiner decisions   │
          │        streamed to UI live  │
          ▼                             ▼
┌─────────────────────────────────────────────┐
│  3. DIVERGENCE ANALYSIS (post-viva)          │
│  Aligns spoken reasoning against document    │
│  spans. Each flag = {timestamp, transcript   │
│  excerpt, doc span, divergence type}.        │
│  Output: the dossier.                        │
└─────────────────────────────────────────────┘
```

**Key design decisions.**
- The voice model *talks*; the examiner *decides*. The Realtime session never freelances the exam plan — it receives its next question from the examiner's structured output. This is the "constraints enforced through architecture, not prompting" lesson, implemented.
- Every examiner decision is an append-only log entry: `{answer_summary, target_claim_id, assessment, action, rationale}`. The live reasoning pane and the dossier are both views over this log. One data structure, two of the three differentiators.
- Divergence types (v1): *cannot reconstruct* (student can't rebuild an argument they wrote), *mechanism gap* (restates conclusion, can't explain why), *inconsistency* (spoken claim contradicts written claim). **Register comparison (written vs. spoken vocabulary) is deliberately excluded** — it rediscovers the non-native-speaker bias that killed detection tools. Content reconstruction is register-independent; that's the design principle, stated in the README as such.

**Stack.** Next.js + Tailwind; OpenAI Realtime API (voice), GPT-5.6 via Responses API with structured outputs (graph, examiner, divergence); Postgres (Supabase) or SQLite for sessions; Vercel hosting. No telephony, no third-party assessment SDKs. Everything judged is in the repo.

## 7. Feature spec

**P0 — must ship (submission is nonviable without):**
- Text/PDF submission upload → claim graph generation + graph inspection view
- Voice viva (5–8 min) with examiner-driven question routing
- Live examiner reasoning pane beside transcript
- Post-viva dossier with span-linked receipts
- Hosted judge demo: sample essay + "defend it yourself" flow, no login
- Practice mode + accommodations note (text-mode fallback, extended time)
- Minimal teacher triage: a dossier list sorted by divergence count (the primary user's core surface cannot be P1; a sortable list is one evening)

**P1 — ship if on schedule:**
- Full teacher dashboard (class analytics, per-claim drill-down)
- Student-facing dossier copy
- "Paste your own text" in the judge demo

**P2 — cut without hesitation:**
- Multi-language vivas, rubric import, LMS integration, proctoring features of any kind (explicitly out — surveillance framing is the reputational third rail)

## 8. Demo video (≤ 3:00)

| Time | Beat |
|---|---|
| 0:00–0:20 | Cold open: two identical-looking essays side by side. "One of these students wrote their essay. Detection tools can't tell you which. Eleza can't either — but it can ask them." |
| 0:20–0:45 | Upload → the essay lights up as a claim graph. Voiceover names differentiator 1. |
| 0:45–1:50 | The controlled comparison, framed honestly as one: both "students" (you, on camera, two takes) sit the same viva. Split screen: transcript left, examiner reasoning pane right. The pane is the star — show it deciding to probe. **Voiceover discipline:** never say Eleza "caught" anything; the dossiers *differ*, the teacher *decides*. One sentence of detection framing contradicts Section 12 on camera. |
| 1:50–2:25 | Dossiers side by side. Zoom on one receipt: timestamp ↔ paragraph span. "Receipts, not verdicts." |
| 2:25–2:50 | Teacher triage view, then the judge demo URL on screen: "Defend an essay yourself, right now." |
| 2:50–3:00 | Codex/GPT-5.6 usage statement (required: audio must cover how both were used). Title card: Eleza. |

Rules compliance: no third-party trademarks, no copyrighted music, all essays synthetic, public YouTube upload.

## 9. Submission checklist (from Official Rules)

- [ ] Fresh repo, first commit July 14 — no pre-existing code anywhere in history
- [ ] One primary Codex thread from day one; capture `/feedback` session ID (required field)
- [ ] Free credits form submitted before **July 17, 12:00 PM PT** (credits expire July 31)
- [ ] README: setup instructions, sample data, and the Codex collaboration narrative — where Codex accelerated, where human decisions were made, how GPT-5.6 was used (explicitly judged)
- [ ] Daily habit: end each build session by logging 2–3 concrete Codex moments (what it wrote, what you overrode, why) — the README narrative is assembled from these, not reconstructed from memory on July 20
- [ ] Repo public with license, or private + shared with testing@devpost.com and build-week-event@openai.com
- [ ] Hosted demo live and free through **August 5** (judging period ends) — Vercel + Supabase free tiers suffice; rate-limit the Realtime endpoint
- [ ] Video < 3 min, public YouTube, audio covers Codex AND GPT-5.6 usage
- [ ] Category: Education, with brief rationale
- [ ] Submit before **July 21, 5:00 PM PT** — target internal deadline July 20 EOD

## 10. Build order (evenings, July 14–20; buffer day July 21)

- **Tue 7/14** — Repo init, Codex thread start, scaffold (Next.js, auth-less session model). Claim graph engine v1: structured-output prompt + JSON schema + graph render. *Credits form tonight.*
- **Wed 7/15** — Realtime API integration: basic voice loop, transcript capture. Examiner v1: single-turn assess-and-route on canned input.
- **Thu 7/16** — Wire examiner ↔ voice session (the routing loop). Live reasoning pane streaming. This is the hardest day; everything after is downhill.
- **Fri 7/17** — Divergence analysis + dossier generation with span links. End-to-end run on a synthetic essay.
- **Sat 7/18** — Judge demo flow (sample essay, no login), practice mode, accommodations fallback. Minimal teacher triage list. Deploy to Vercel; rate limiting. Full dogfood: run five vivas, fix what breaks.
- **Sun 7/19** — Full teacher dashboard (P1 if healthy; minimal triage list already shipped P0 Saturday). Record video takes. README Codex narrative drafted from the actual session log.
- **Mon 7/20** — Video edit, final QA on hosted demo, submission form completed and submitted. 
- **Tue 7/21** — Buffer only. Do not plan work here.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Realtime API latency makes the viva feel laggy | Examiner runs on the *previous* answer while the voice model asks a pre-fetched bridge question; pipeline the turn, never block on it |
| Examiner decisions look generic → differentiator 2 collapses | Force rationale to cite the target claim ID and quote the answer; reject-and-retry on generic outputs at the schema level. **Video acceptance bar:** no take ships unless every visible rationale references specific essay content — this is the single highest-leverage QA check in the project |
| Claim graph is wrong/shallow on real essays | Graph inspection view makes errors visible and correctable (teacher edit = P1); constrain v1 to argumentative essays, say so honestly |
| Voice demo fails during video recording | Record early (Sat), multiple takes; the dossier and reasoning pane carry the pitch even if one take is imperfect |
| Judge tries demo with adversarial/off-domain text | "Paste your own" is P1, behind the curated sample; input length caps; graceful "this works best on argumentative writing" messaging |
| Equity/surveillance criticism | Practice mode, text fallback, bidirectional dossiers, no verdict score — designed in, and stated in README as design principles |

## 12. Out of scope — declared, not implied

No proctoring, no camera analysis, no authenticity percentage, no detection claims of any kind. Eleza does not tell anyone whether AI wrote the essay. It shows whether the student can defend it — and shows its own work while asking.