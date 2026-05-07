import assert from "node:assert/strict";
import test from "node:test";
import { createInitialState, createResearchGraph } from "../src/graph.js";
import type { ResearchModel, TavilyService } from "../src/types.js";

const fakeModel: ResearchModel = {
  async plan(question) {
    return {
      objective: `Understand ${question}`,
      tasks: [
        {
          title: "Find comparison sources",
          query: "RAG long context comparison",
          rationale: "Need external context.",
        },
      ],
    };
  },
  async synthesize(input) {
    const sourceLines = input.sources
      .map((source) => `- [${source.id}] ${source.title}: ${source.url}`)
      .join("\n");
    return [
      "# Research Report",
      "",
      `Question: ${input.question}`,
      "",
      "## Conclusion",
      "",
      input.findings[0]?.summary ?? "No findings",
      "",
      "## Sources",
      "",
      sourceLines,
    ].join("\n");
  },
};

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
  async extract(input) {
    return {
      results: input.urls.map((url) => ({
        url,
        title: "RAG guide",
        rawContent: "Detailed extracted RAG content.",
      })),
      failedResults: [],
    };
  },
};

test("graph runs end-to-end with fake model and Tavily", async () => {
  const graph = createResearchGraph({
    model: fakeModel,
    tavily: fakeTavily,
    now: () => "2026-05-06T00:00:00.000Z",
  });

  const result = await graph.invoke(
    createInitialState("Compare RAG and long context"),
  );

  assert.equal(result.todos[0]?.status, "done");
  assert.equal(result.sources.length, 1);
  assert.match(result.report ?? "", /# Research Report/);
  assert.match(result.report ?? "", /https:\/\/example.com\/rag/);
});
