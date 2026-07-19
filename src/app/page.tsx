import { readFile } from "node:fs/promises";
import path from "node:path";
import DemoLanding from "@/app/demo-landing";
import { caseAnalysisDemoGraph, codeDemoGraph, judgeDemoGraph, labReportDemoGraph, practiceDemoGraph } from "@/lib/demo-fixtures";

export default async function Home() {
  const [judgeText, practiceText, codeText, labReportText, caseAnalysisText] = await Promise.all([
    readFile(path.join(process.cwd(), "fixtures", "community-gardens-argument.txt"), "utf8"),
    readFile(path.join(process.cwd(), "fixtures", "practice-transit-argument.txt"), "utf8"),
    readFile(path.join(process.cwd(), "fixtures", "code-inventory-tracker.py"), "utf8"),
    readFile(path.join(process.cwd(), "fixtures", "lab-photosynthesis-report.txt"), "utf8"),
    readFile(path.join(process.cwd(), "fixtures", "case-expansion-memo.txt"), "utf8"),
  ]);
  return <DemoLanding
    judge={{ title: "Community gardens and resilient neighborhoods", sourceText: judgeText, graph: judgeDemoGraph(judgeText) }}
    practice={{ title: "A bus lane for the downtown ring road", sourceText: practiceText, graph: practiceDemoGraph(practiceText) }}
    code={{ title: "Inventory tracker", sourceText: codeText, graph: codeDemoGraph(codeText) }}
    labReport={{ title: "Light availability and photosynthesis", sourceText: labReportText, graph: labReportDemoGraph(labReportText) }}
    caseAnalysis={{ title: "A second tool-lending pickup site", sourceText: caseAnalysisText, graph: caseAnalysisDemoGraph(caseAnalysisText) }}
  />;
}
