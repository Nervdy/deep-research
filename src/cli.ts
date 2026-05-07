import { resolve } from "node:path";
import { assertRuntimeConfig } from "./config.js";
import { runResearch } from "./agent.js";

interface CliArgs {
  question: string;
  outputDir?: string | undefined;
}

function usage(): string {
  return [
    'Usage: bun run research -- "research question" [--output-dir output]',
    "",
    "Required env: OPENAI_API_KEY, TAVILY_API_KEY",
  ].join("\n");
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args = [...argv];
  let outputDir: string | undefined;
  const questionParts: string[] = [];

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) continue;
    if (arg === "--output-dir" || arg === "--out" || arg === "-o") {
      const value = args.shift();
      if (!value) throw new Error(`${arg} requires a directory path.`);
      outputDir = value;
      continue;
    }
    questionParts.push(arg);
  }

  const question = questionParts.join(" ").trim();
  if (!question) {
    throw new Error(usage());
  }

  return outputDir ? { question, outputDir } : { question };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  assertRuntimeConfig();

  const result = await runResearch(args.question, {
    outputDir: args.outputDir,
  });
  const latestReport = result.reports.at(-1);

  if (latestReport) {
    console.log(`Wrote ${resolve(latestReport.path)}`);
    return;
  }

  console.log(result.finalText);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
