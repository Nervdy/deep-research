import assert from "node:assert/strict";
import test from "node:test";
import { assertRuntimeConfig } from "../src/config.js";

test("config reports missing required runtime keys", () => {
  assert.throws(
    () => assertRuntimeConfig({ openAIModel: "test-model" }),
    /OPENAI_API_KEY, TAVILY_API_KEY/,
  );
});

test("config accepts required runtime keys", () => {
  const config = assertRuntimeConfig({
    openAIModel: "test-model",
    openAIApiKey: "openai-key",
    tavilyApiKey: "tavily-key",
  });

  assert.equal(config.openAIModel, "test-model");
  assert.equal(config.openAIApiKey, "openai-key");
  assert.equal(config.tavilyApiKey, "tavily-key");
});
