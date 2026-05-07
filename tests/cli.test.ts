import assert from "node:assert/strict";
import test from "node:test";
import { parseCliArgs } from "../src/cli.js";

test("cli parses question and output directory", () => {
  assert.deepEqual(parseCliArgs(["hello", "world", "--output-dir", "reports"]), {
    question: "hello world",
    outputDir: "reports",
  });
});

test("cli rejects missing question", () => {
  assert.throws(() => parseCliArgs([]), /Usage: bun run research/);
});

test("cli rejects --out without path", () => {
  assert.throws(() => parseCliArgs(["question", "--out"]), /requires/);
});
