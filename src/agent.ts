import { createAgent, type CreateAgentParams } from "langchain";
import { createChatModel } from "./model.js";
import {
  createReportTool,
  type ReportToolOptions,
} from "./report.js";
import { createTavilySearchTool } from "./tools/tavily.js";
import type { ReportWriteResult, TavilyService } from "./types.js";

type AgentModel = CreateAgentParams<Record<string, unknown>>["model"];

export interface ResearchAgentOptions
  extends Omit<ReportToolOptions, "onSave"> {
  model?: AgentModel | undefined;
  tavily?: TavilyService | undefined;
  onReportSaved?: ((result: ReportWriteResult) => void) | undefined;
}

export interface ResearchRunOptions extends ResearchAgentOptions {
  recursionLimit?: number | undefined;
}

export interface ResearchRunResult {
  state: unknown;
  messages: Array<{ content: unknown; _getType?: () => string; type?: string }>;
  reports: ReportWriteResult[];
  finalText: string;
}

function currentDate(now: () => Date | string): string {
  const value = now();
  const iso = value instanceof Date ? value.toISOString() : value;
  return iso.slice(0, 10);
}

function createSystemPrompt(now: () => Date | string): string {
  return [
    "You are a deep-research agent that works autonomously in a ReAct loop.",
    `Current date: ${currentDate(now)}.`,
    "",
    "Decide for yourself whether web search is needed. Use tavily_search for external, source-backed, or time-sensitive facts; skip it when the question can be answered reliably without search.",
    "When you use search results, cite source URLs in the report. Do not invent citations.",
    "When the research is complete, call write_report exactly once with the full Markdown report. The report should include the user's question, findings, sources, and limitations.",
    "After write_report succeeds, respond briefly with the saved path and no extra report copy.",
  ].join("\n");
}

export function createResearchAgent(options: ResearchAgentOptions = {}) {
  const now = options.now ?? (() => new Date());
  const reportTool = createReportTool({
    outputDir: options.outputDir,
    now,
    onSave: options.onReportSaved,
  });

  return createAgent({
    model: options.model ?? createChatModel(),
    tools: [createTavilySearchTool(options.tavily), reportTool],
    systemPrompt: createSystemPrompt(now),
    name: "deep_research",
    version: "v2",
  });
}

export function stringifyMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text);
        }
        return "";
      })
      .join("");
  }
  return "";
}

function messageType(message: ResearchRunResult["messages"][number]): string {
  if (typeof message._getType === "function") return message._getType();
  return message.type ?? "";
}

export function getFinalText(
  messages: ResearchRunResult["messages"],
): string {
  for (const message of [...messages].reverse()) {
    if (messageType(message) === "tool") continue;
    const content = stringifyMessageContent(message.content).trim();
    if (content) return content;
  }
  return "";
}

export async function runResearch(
  question: string,
  options: ResearchRunOptions = {},
): Promise<ResearchRunResult> {
  const reports: ReportWriteResult[] = [];
  const agent = createResearchAgent({
    ...options,
    onReportSaved: (result) => {
      reports.push(result);
      options.onReportSaved?.(result);
    },
  });

  const state = await agent.invoke(
    { messages: [{ role: "user", content: question }] },
    { recursionLimit: options.recursionLimit ?? 40 },
  );
  const messages = state.messages as ResearchRunResult["messages"];

  return {
    state,
    messages,
    reports,
    finalText: getFinalText(messages),
  };
}
