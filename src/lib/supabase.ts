import { createClient } from "@supabase/supabase-js";
import type { ClaimGraph } from "@/lib/claim-graph";
import { profileIdSchema, type ProfileId } from "@/lib/domain-profile";

export async function persistClaimGraph(filename: string, sourceText: string, graph: ClaimGraph, profileId: ProfileId = "essay") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const parsedProfileId = profileIdSchema.parse(profileId);
  if (!url || !key) return { persisted: false, profileId: parsedProfileId };
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const submission = await supabase.from("submissions").insert({ filename, source_text: sourceText, profile_id: parsedProfileId }).select("id").single();
  if (submission.error) throw new Error(`Could not save submission: ${submission.error.message}`);
  const savedGraph = await supabase.from("claim_graphs").insert({ submission_id: submission.data.id, graph }).select("id").single();
  if (savedGraph.error) throw new Error(`Could not save graph: ${savedGraph.error.message}`);
  return { persisted: true, submissionId: submission.data.id, graphId: savedGraph.data.id, profileId: parsedProfileId };
}
