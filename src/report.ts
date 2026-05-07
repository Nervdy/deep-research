import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tool } from "langchain";
import { z } from "zod";
import type { ReportInput, ReportWriteResult } from "./types.js";

export const ReportInputSchema = z.object({
  title: z.string().min(1).optional(),
  fileName: z
    .string()
    .min(1)
    .optional()
    .describe("Optional Markdown file name. Directory components are ignored."),
  content: z.string().min(1).describe("Complete Markdown report content."),
});

export interface ReportToolOptions {
  outputDir?: string | undefined;
  now?: (() => Date | string) | undefined;
  onSave?: ((result: ReportWriteResult) => void) | undefined;
}

function timestamp(now: () => Date | string): string {
  const value = now();
  const iso = value instanceof Date ? value.toISOString() : value;
  const compact = iso.replace(/\D/g, "").slice(0, 14);
  return compact || new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

export function sanitizeReportFileName(value: string): string {
  const stem = value
    .replace(/\.md$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 80);

  return `${stem || "research-report"}.md`;
}

function defaultReportFileName(input: ReportInput, now: () => Date | string) {
  const title = input.fileName ?? input.title ?? "research-report";
  const baseName = sanitizeReportFileName(title).replace(/\.md$/i, "");
  return `${baseName}-${timestamp(now)}.md`;
}

export async function writeReport(
  input: ReportInput,
  options: ReportToolOptions = {},
): Promise<ReportWriteResult> {
  const parsed = ReportInputSchema.parse(input);
  const now = options.now ?? (() => new Date());
  const outputDir = resolve(options.outputDir ?? "output");
  const fileName = parsed.fileName
    ? sanitizeReportFileName(parsed.fileName)
    : defaultReportFileName(parsed, now);
  const outputPath = resolve(outputDir, fileName);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, parsed.content, "utf8");

  return {
    path: outputPath,
    fileName,
    bytes: Buffer.byteLength(parsed.content, "utf8"),
  };
}

export function createReportTool(options: ReportToolOptions = {}) {
  return tool(
    async (input: ReportInput) => {
      const result = await writeReport(input, options);
      options.onSave?.(result);
      return JSON.stringify(result, null, 2);
    },
    {
      name: "write_report",
      description:
        "Save the final Markdown research report to the configured output directory. Call this when the report is complete.",
      schema: ReportInputSchema,
    },
  );
}
