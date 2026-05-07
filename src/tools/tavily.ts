import { tool } from "@langchain/core/tools";
import { tavily, type TavilyClient } from "@tavily/core";
import { z } from "zod";
import { readRuntimeConfig } from "../config.js";
import type {
  TavilyExtractInput,
  TavilyExtractOutput,
  TavilySearchInput,
  TavilySearchOutput,
  TavilyService,
} from "../types.js";

export const TavilySearchInputSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(10).optional(),
});

export const TavilyExtractInputSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(5),
});

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export function createTavilyServiceFromClient(
  client: Pick<TavilyClient, "search" | "extract">,
): TavilyService {
  return {
    async search(input: TavilySearchInput): Promise<TavilySearchOutput> {
      const parsed = TavilySearchInputSchema.parse(input);
      const response = await client.search(parsed.query, {
        searchDepth: "advanced",
        maxResults: parsed.maxResults ?? 5,
        includeAnswer: false,
        includeRawContent: false,
      });

      return {
        query: response.query ?? parsed.query,
        results: response.results.map((result) => ({
          title: result.title,
          url: result.url,
          content: truncate(result.content ?? "", 1200),
          score: typeof result.score === "number" ? result.score : undefined,
          publishedDate:
            typeof result.publishedDate === "string"
              ? result.publishedDate
              : undefined,
        })),
      };
    },

    async extract(input: TavilyExtractInput): Promise<TavilyExtractOutput> {
      const parsed = TavilyExtractInputSchema.parse(input);
      const response = await client.extract(parsed.urls, {
        extractDepth: "basic",
        format: "markdown",
      });

      return {
        results: response.results.map((result) => ({
          url: result.url,
          title: result.title ?? undefined,
          rawContent: truncate(result.rawContent ?? "", 4000),
        })),
        failedResults: response.failedResults.map((failed) => ({
          url: failed.url,
          error: failed.error,
        })),
      };
    },
  };
}

export function createTavilyService(apiKey = readRuntimeConfig().tavilyApiKey) {
  if (!apiKey) {
    throw new Error(
      "Missing TAVILY_API_KEY. Create .env from .env.example and fill it.",
    );
  }
  return createTavilyServiceFromClient(tavily({ apiKey }));
}

export function createTavilySearchTool(service: TavilyService) {
  return tool(
    async (input: TavilySearchInput) =>
      JSON.stringify(await service.search(input), null, 2),
    {
      name: "tavily_search",
      description:
        "Search the web with Tavily and return normalized title, URL, snippet, and score results.",
      schema: TavilySearchInputSchema,
    },
  );
}

export function createTavilyExtractTool(service: TavilyService) {
  return tool(
    async (input: TavilyExtractInput) =>
      JSON.stringify(await service.extract(input), null, 2),
    {
      name: "tavily_extract",
      description:
        "Extract readable page content from URLs returned by Tavily search.",
      schema: TavilyExtractInputSchema,
    },
  );
}
