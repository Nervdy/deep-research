import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  sanitizeReportFileName,
  writeReport,
} from "../src/report.js";

test("report writer saves Markdown to the output directory", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "deep-research-report-"));
  const result = await writeReport(
    {
      title: "RAG / long context",
      content: "# Report\n\nDone.",
    },
    {
      outputDir,
      now: () => "2026-05-06T00:00:00.000Z",
    },
  );

  assert.equal(result.fileName, "RAG-long-context-20260506000000.md");
  assert.equal(await readFile(result.path, "utf8"), "# Report\n\nDone.");
});

test("report file names are sanitized", () => {
  assert.equal(sanitizeReportFileName("../bad name.md"), "bad-name.md");
});
