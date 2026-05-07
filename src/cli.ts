import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { assertRuntimeConfig } from "./config.js";
import { createInitialState, graph } from "./graph.js";
import { renderFallbackReport } from "./report.js";

interface CliArgs {
  question: string;
  out?: string;
}

function usage(): string {
  return [
    'Usage: bun run research -- "research question" [--out report.md]',
    "",
    "Required env: OPENAI_API_KEY, TAVILY_API_KEY",
  ].join("\n");
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args = [...argv];
  let out: string | undefined;
  const questionParts: string[] = [];

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) continue;
    if (arg === "--out" || arg === "-o") {
      const value = args.shift();
      if (!value) throw new Error("--out requires a file path.");
      out = value;
      continue;
    }
    questionParts.push(arg);
  }

  const question = questionParts.join(" ").trim();
  if (!question) {
    throw new Error(usage());
  }

  return out ? { question, out } : { question };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  assertRuntimeConfig();

  graph.getGraphAsync().then((graph) => {
    const mermaid = graph.drawMermaid();
    Bun.write("graph2.mermaid.txt", mermaid);
  });
  const result = await graph.invoke(createInitialState(args.question));
  const report = result.report ?? renderFallbackReport(result);

  if (args.out) {
    const outputPath = resolve(args.out);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, report, "utf8");
    console.log(`Wrote ${outputPath}`);
    return;
  }

  console.log(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
