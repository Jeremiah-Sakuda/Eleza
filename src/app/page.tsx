import { readFile } from "node:fs/promises";
import path from "node:path";
import DemoLanding from "@/app/demo-landing";
import { judgeDemoGraph, practiceDemoGraph } from "@/lib/demo-fixtures";

export default async function Home() {
  const [judgeText, practiceText] = await Promise.all([
    readFile(path.join(process.cwd(), "fixtures", "community-gardens-argument.txt"), "utf8"),
    readFile(path.join(process.cwd(), "fixtures", "practice-transit-argument.txt"), "utf8"),
  ]);
  return <DemoLanding
    judge={{ title: "Community gardens and resilient neighborhoods", sourceText: judgeText, graph: judgeDemoGraph(judgeText) }}
    practice={{ title: "A bus lane for the downtown ring road", sourceText: practiceText, graph: practiceDemoGraph(practiceText) }}
  />;
}
