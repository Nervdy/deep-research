import { ChatOpenAI } from "@langchain/openai";
import { readRuntimeConfig } from "./config.js";

export function createChatModel() {
  const config = readRuntimeConfig();

  return new ChatOpenAI({
    model: config.openAIModel,
    temperature: 0,
    apiKey: config.openAIApiKey,
    ...(config.openAIBaseUrl
      ? { configuration: { baseURL: config.openAIBaseUrl } }
      : {}),
  });
}
