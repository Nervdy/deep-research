import assert from "node:assert/strict";
import test from "node:test";
import { createTavilyServiceFromClient } from "../src/tools/tavily.js";

test("tavily service normalizes search and extract responses", async () => {
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
    async extract(urls) {
      return {
        responseTime: 0.2,
        requestId: "extract-1",
        results: [
          {
            url: urls[0] ?? "https://example.com/rag",
            title: "RAG overview",
            rawContent: "Long extracted page content.",
          },
        ],
        failedResults: [],
      };
    },
  });

  const search = await service.search({ query: "rag", maxResults: 1 });
  assert.equal(search.query, "rag");
  assert.equal(search.results[0]?.title, "RAG overview");
  assert.equal(search.results[0]?.score, 0.9);

  const extract = await service.extract({ urls: ["https://example.com/rag"] });
  assert.equal(extract.results[0]?.rawContent, "Long extracted page content.");
  assert.deepEqual(extract.failedResults, []);
});

test("tavily service validates URLs before extract", async () => {
  const service = createTavilyServiceFromClient({
    async search() {
      throw new Error("not used");
    },
    async extract() {
      throw new Error("should not call client");
    },
  });

  await assert.rejects(
    () => service.extract({ urls: ["not-a-url"] }),
    /Invalid URL/,
  );
});
