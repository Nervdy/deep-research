import { tavily, type TavilyClient } from "@tavily/core";
import { tool } from "langchain";
import { z } from "zod";
import { readRuntimeConfig } from "../config.js";
import type {
  TavilySearchInput,
  TavilySearchOutput,
  TavilyService,
} from "../types.js";

export const TavilySearchInputSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().min(1).max(10).optional(),
});

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export function createTavilyServiceFromClient(
  client: Pick<TavilyClient, "search">,
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

export function createTavilySearchTool(service?: TavilyService | undefined) {
  let defaultService: TavilyService | undefined = service;

  return tool(
    async (input: TavilySearchInput) => {
      defaultService ??= createTavilyService();
      return JSON.stringify(await defaultService.search(input), null, 2);
    },
    {
      name: "tavily_search",
      description:
        "Search the web with Tavily when external or up-to-date information is needed. Returns titles, URLs, snippets, scores, and published dates when available.",
      schema: TavilySearchInputSchema,
    },
  );
}
