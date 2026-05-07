import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FakeToolCallingModel } from "langchain";
import { runResearch } from "../src/agent.js";
import type { TavilyService } from "../src/types.js";

const fakeTavily: TavilyService = {
  async search(input) {
    return {
      query: input.query,
      results: [
        {
          title: "RAG guide",
          url: "https://example.com/rag",
          content: "RAG retrieves external context before generation.",
          score: 0.95,
        },
      ],
    };
  },
};

test("agent lets the model choose Tavily and report tools", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "deep-research-"));
  const model = new FakeToolCallingModel({
    toolCalls: [
      [
        {
          name: "tavily_search",
          args: { query: "RAG long context comparison", maxResults: 1 },
          id: "search-1",
        },
      ],
      [
        {
          name: "write_report",
          args: {
            title: "RAG comparison",
            content:
              "# RAG comparison\n\nRAG retrieves external context. Source: https://example.com/rag",
          },
          id: "report-1",
        },
      ],
      [],
    ],
  });

  const result = await runResearch("Compare RAG and long context", {
    model,
    tavily: fakeTavily,
    outputDir,
    now: () => "2026-05-06T00:00:00.000Z",
  });

  assert.equal(result.reports.length, 1);
  assert.match(result.reports[0]?.fileName ?? "", /^RAG-comparison-/);

  const content = await readFile(result.reports[0]?.path ?? "", "utf8");
  assert.match(content, /# RAG comparison/);
  assert.match(content, /https:\/\/example.com\/rag/);
});
