# Eleza

Eleza is a transparent oral-defense tool for argumentative writing. It parses a submission into claim spans, conducts an examiner-routed viva, and returns a dossier of transcript-to-document receipts. It does not produce authenticity scores or verdicts.

## Run locally

Requirements: Node.js 20+, an OpenAI API key, and a Supabase project.

```bash
git clone https://github.com/Jeremiah-Sakuda/Eleza.git
cd Eleza
npm install
cp .env.example .env.local
```

Fill these values in `.env.local`:

```dotenv
OPENAI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DEMO_GLOBAL_DAILY_CAP=200
```

Apply every SQL file in `supabase/migrations` in filename order using the Supabase SQL Editor, then run:

```bash
npm test
npm run build
npm run dev
```

The public judge flow is at `http://localhost:3000`. `/inspect` retains text/PDF upload and graph inspection; `/triage` lists completed dossiers.

## Production deployment on Vercel

The deployed app uses only server-side environment variables for secrets. The browser requests OpenAI's minimum-lifetime (10-second) Realtime client secret from `/api/realtime/token`, then exchanges WebRTC SDP and audio directly with OpenAI. The standard OpenAI key never enters a client response or bundle.

1. Create a Supabase project and apply `001_claim_graphs.sql` through `004_demo_rate_limits.sql` in order.
2. Link a Vercel project from a fresh clone:

   ```bash
   npx vercel link
   ```

3. Add `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `DEMO_GLOBAL_DAILY_CAP` to the Vercel Production, Preview, and Development environments. Keep the OpenAI and service-role values marked sensitive.
4. Verify the production build and client bundles:

   ```bash
   npm test
   npm run build
   npm run verify:client-secrets
   ```

5. Deploy and verify:

   ```bash
   npx vercel deploy --prod
   curl -i https://YOUR_DOMAIN/api/health
   ```

`vercel.json` registers a daily `/api/health` cron. Public session creation is atomically limited in Supabase to five sessions per salted IP digest per UTC day and a global daily cap of 200 by default. Realtime token issuance applies the same limits. Judge sessions are clamped to 150 seconds in the database and checked again before every examiner turn.

Production acceptance should include Chrome and Safari microphone permission on the HTTPS domain, one desktop and one physical phone, a complete voice viva, a complete typed viva, confirmation that attempt six from one connection receives HTTP 429 with the next UTC retry time, and a 200 response from `/api/health`.

## Architecture invariants

- The Realtime voice model speaks externally routed questions; the GPT-5.6 examiner chooses every next move.
- Every persisted examiner decision is one append-only log entry rendered by both the live pane and dossier.
- Rationale receipts are rejected unless they cite the target claim ID and quote the answer exactly.
- Divergence analysis is limited to content reconstruction: `cannot_reconstruct`, `mechanism_gap`, and `inconsistency`.
- Eleza presents evidence only. Humans decide.
