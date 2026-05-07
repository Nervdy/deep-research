import assert from "node:assert/strict";
import test from "node:test";
import { parseCliArgs } from "../src/cli.js";

test("cli parses question and output path", () => {
  assert.deepEqual(parseCliArgs(["hello", "world", "--out", "report.md"]), {
    question: "hello world",
    out: "report.md",
  });
});

test("cli rejects missing question", () => {
  assert.throws(() => parseCliArgs([]), /Usage: bun run research/);
});

test("cli rejects --out without path", () => {
  assert.throws(() => parseCliArgs(["question", "--out"]), /requires/);
});
