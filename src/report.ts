import type { ResearchState, SynthesisInput } from "./types.js";

function sourceLabel(sourceId: string): string {
  return `[${sourceId}]`;
}

export function renderFallbackReport(
  input: SynthesisInput | ResearchState,
  error?: unknown,
): string {
  const findings = input.findings;
  const sources = input.sources;
  const limitations = [...input.limitations];
  const errors = [...input.errors];

  if (error instanceof Error) {
    errors.push(error.message);
  }

  const findingBlocks =
    findings.length > 0
      ? findings
          .map((finding) => {
            const refs = finding.sourceIds.map(sourceLabel).join(" ");
            return `- ${finding.summary}${refs ? ` ${refs}` : ""}`;
          })
          .join("\n")
      : "- No findings were produced.";

  const sourceBlocks =
    sources.length > 0
      ? sources
          .map((source) => {
            const title = source.title || source.url;
            return `- [${source.id}] ${title}: ${source.url}`;
          })
          .join("\n")
      : "- No sources were collected.";

  const limitationBlocks =
    limitations.length > 0
      ? limitations.map((item) => `- ${item}`).join("\n")
      : "- None recorded.";

  const errorBlocks =
    errors.length > 0 ? errors.map((item) => `- ${item}`).join("\n") : "";

  return [
    `# Research Report`,
    "",
    `## Question`,
    "",
    input.question,
    "",
    `## Findings`,
    "",
    findingBlocks,
    "",
    `## Sources`,
    "",
    sourceBlocks,
    "",
    `## Limitations`,
    "",
    limitationBlocks,
    errorBlocks ? "\n## Runtime Errors\n\n" + errorBlocks : "",
  ]
    .filter((part) => part !== "")
    .join("\n");
}
