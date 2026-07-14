import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  }))).flat();
}

async function main() {
  const secrets = [process.env.OPENAI_API_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY].filter((value) => value && value.length >= 16);
  if (secrets.length !== 2) throw new Error("OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY are required for the bundle scan.");
  const staticRoot = path.join(process.cwd(), ".next", "static");
  const files = await filesUnder(staticRoot);
  for (const file of files) {
    const contents = await readFile(file);
    if (secrets.some((secret) => contents.includes(Buffer.from(secret)))) {
      throw new Error(`A server secret was found in client bundle ${path.relative(process.cwd(), file)}.`);
    }
  }
  console.log(`Client bundle scan passed across ${files.length} static assets; no server secret values were present.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
