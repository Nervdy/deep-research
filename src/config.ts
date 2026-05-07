import { config as loadDotenv } from "dotenv";

loadDotenv({ quiet: true });

export interface RuntimeConfig {
  openAIApiKey?: string | undefined;
  openAIModel: string;
  openAIBaseUrl?: string | undefined;
  tavilyApiKey?: string | undefined;
  langSmithApiKey?: string | undefined;
  langSmithTracing?: string | undefined;
}

export type RequiredRuntimeConfig = RuntimeConfig & {
  openAIApiKey: string;
  tavilyApiKey: string;
};

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function readRuntimeConfig(): RuntimeConfig {
  return {
    openAIApiKey: envValue("OPENAI_API_KEY"),
    openAIModel: envValue("OPENAI_MODEL") ?? "gpt-4.1-mini",
    openAIBaseUrl: envValue("OPENAI_BASE_URL"),
    tavilyApiKey: envValue("TAVILY_API_KEY"),
    langSmithApiKey: envValue("LANGSMITH_API_KEY"),
    langSmithTracing: envValue("LANGSMITH_TRACING"),
  };
}

export function assertRuntimeConfig(
  config: RuntimeConfig = readRuntimeConfig(),
): RequiredRuntimeConfig {
  const missing: string[] = [];
  if (!config.openAIApiKey) missing.push("OPENAI_API_KEY");
  if (!config.tavilyApiKey) missing.push("TAVILY_API_KEY");

  if (missing.length > 0) {
    throw new Error(
      [
        `Missing required environment variable(s): ${missing.join(", ")}`,
        "Create .env from .env.example and fill the required keys.",
      ].join("\n"),
    );
  }

  return config as RequiredRuntimeConfig;
}
