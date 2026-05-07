import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { readRuntimeConfig } from "./config.js";
import type { PlannerOutput, ResearchModel, SynthesisInput } from "./types.js";

const PlannerOutputSchema = z.object({
  objective: z.string().min(1),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1),
        query: z.string().min(1),
        rationale: z.string().min(1).optional(),
      }),
    )
    .min(1)
    .max(5),
});

export function createChatModel() {
  const config = readRuntimeConfig();
  if (!config.openAIApiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY. Create .env from .env.example and fill it.",
    );
  }

  return new ChatOpenAI({
    model: config.openAIModel,
    temperature: 0,
    apiKey: config.openAIApiKey,
    ...(config.openAIBaseUrl
      ? { configuration: { baseURL: config.openAIBaseUrl } }
      : {}),
  });
}

function normalizePlannerOutput(
  question: string,
  output: PlannerOutput,
): PlannerOutput {
  const tasks = output.tasks
    .filter((task) => task.title.trim() && task.query.trim())
    .slice(0, 5);

  if (tasks.length > 0) {
    return {
      objective: output.objective.trim(),
      tasks: tasks.map((task) => ({
        title: task.title.trim(),
        query: task.query.trim(),
        rationale: task.rationale?.trim(),
      })),
    };
  }

  return {
    objective: `Research: ${question}`,
    tasks: [{ title: "Research the question", query: question }],
  };
}

function stringifyContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text);
        }
        return JSON.stringify(part);
      })
      .join("");
  }
  return String(content ?? "");
}

export function createOpenAIResearchModel(): ResearchModel {
  let model: ChatOpenAI | undefined;
  const getModel = () => {
    model ??= createChatModel();
    return model;
  };

  return {
    async plan(question: string): Promise<PlannerOutput> {
      const planner = getModel().withStructuredOutput(PlannerOutputSchema, {
        name: "research_plan",
        strict: true,
      });
      const output = (await planner.invoke([
        {
          role: "system",
          content:
            "You are the planner in a learning deep-research agent. Break the question into 2-5 concrete web research tasks. Return concise tasks only.",
        },
        { role: "user", content: question },
      ])) as PlannerOutput;

      return normalizePlannerOutput(question, output);
    },

    async synthesize(input: SynthesisInput): Promise<string> {
      const response = await getModel().invoke([
        {
          role: "system",
          content:
            "You are the synthesizer in a learning deep-research agent. Write a concise Markdown report. Cite sources by their bracketed ids, include limitations, and do not invent sources.",
        },
        {
          role: "user",
          content: JSON.stringify(input, null, 2),
        },
      ]);

      return stringifyContent(response.content).trim();
    },
  };
}
