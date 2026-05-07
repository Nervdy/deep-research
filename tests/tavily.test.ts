import assert from "node:assert/strict";
import test from "node:test";
import {
  createTavilySearchTool,
  createTavilyServiceFromClient,
} from "../src/tools/tavily.js";

test("tavily service normalizes search responses", async () => {
  const service = createTavilyServiceFromClient({
    async search(query) {
      return {
        query,
        responseTime: 0.1,
        images: [],
        requestId: "search-1",
        results: [
          {
            title: "RAG overview",
            url: "https://example.com/rag",
            content: "Retrieval augmented generation overview.",
            score: 0.9,
            publishedDate: "2026-01-01",
          },
        ],
      };
    },
  });

  const search = await service.search({ query: "rag", maxResults: 1 });
  assert.equal(search.query, "rag");
  assert.equal(search.results[0]?.title, "RAG overview");
  assert.equal(search.results[0]?.score, 0.9);
});

test("tavily tool returns JSON search output", async () => {
  const tool = createTavilySearchTool({
    async search(input) {
      return {
        query: input.query,
        results: [
          {
            title: "RAG overview",
            url: "https://example.com/rag",
            content: "Retrieval augmented generation overview.",
          },
        ],
      };
    },
  });

  const result = await tool.invoke({ query: "rag", maxResults: 1 });
  assert.match(result, /RAG overview/);
  assert.match(result, /https:\/\/example.com\/rag/);
});
