import {
  Annotation,
  END,
  START,
  StateGraph,
  type GraphNode,
} from "@langchain/langgraph";
import { createOpenAIResearchModel } from "./model.js";
import { renderFallbackReport } from "./report.js";
import { applyTodoOperation } from "./tools/todo.js";
import { createTavilyService } from "./tools/tavily.js";
import type {
  PlannerOutput,
  ResearchFinding,
  ResearchGraphDependencies,
  ResearchSource,
  ResearchState,
  SearchResult,
  SupervisorAction,
  TavilyExtractResult,
} from "./types.js";

const replaceReducer = <T>(_left: T, right: T): T => right;

export const ResearchStateAnnotation = Annotation.Root({
  question: Annotation<string>({
    reducer: replaceReducer,
    default: () => "",
  }),
  todos: Annotation<ResearchState["todos"]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  plan: Annotation<string[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  searchResults: Annotation<SearchResult[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  sources: Annotation<ResearchSource[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  findings: Annotation<ResearchFinding[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  report: Annotation<string | undefined>({
    reducer: replaceReducer,
    default: () => undefined,
  }),
  errors: Annotation<string[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  limitations: Annotation<string[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  nextAction: Annotation<SupervisorAction>({
    reducer: replaceReducer,
    default: () => "plan",
  }),
  completedAt: Annotation<string | undefined>({
    reducer: replaceReducer,
    default: () => undefined,
  }),
});

export type ResearchGraphState = typeof ResearchStateAnnotation.State;
export type ResearchGraphUpdate = typeof ResearchStateAnnotation.Update;

type ResearchNode = GraphNode<typeof ResearchStateAnnotation>;

const DEFAULT_MAX_SEARCH_RESULTS = 5;
const DEFAULT_MAX_EXTRACT_RESULTS = 2;

export function createInitialState(question: string): ResearchGraphUpdate {
  return {
    question,
    todos: [],
    plan: [],
    searchResults: [],
    sources: [],
    findings: [],
    errors: [],
    limitations: [],
    nextAction: "plan",
  };
}

export function decideNextAction(state: ResearchState): SupervisorAction {
  if (state.report?.trim()) return "end";
  if (state.todos.length === 0) return "plan";
  if (
    state.todos.some(
      (todoItem) =>
        todoItem.status === "pending" || todoItem.status === "in_progress",
    )
  ) {
    return "research";
  }
  return "synthesize";
}

function fallbackPlan(question: string): PlannerOutput {
  return {
    objective: `Research: ${question}`,
    tasks: [{ title: "Research the question", query: question }],
  };
}

function planToLines(plan: PlannerOutput): string[] {
  return [
    `Objective: ${plan.objective}`,
    ...plan.tasks.map((task, index) => `${index + 1}. ${task.title}`),
  ];
}

function ensureSourceIds(
  existingSources: ResearchSource[],
  searchResults: Omit<SearchResult, "todoId">[],
  extractedResults: TavilyExtractResult[],
  todoId: string,
): { sources: ResearchSource[]; sourceIds: string[] } {
  const sources: ResearchSource[] = existingSources.map((source) => ({
    ...source,
  }));
  const byUrl = new Map<string, ResearchSource>(
    sources.map((source) => [source.url, source]),
  );
  const sourceIds: string[] = [];

  for (const result of searchResults) {
    const extracted = extractedResults.find((item) => item.url === result.url);
    let source = byUrl.get(result.url);
    if (!source) {
      source = {
        id: `src-${sources.length + 1}`,
        title: extracted?.title ?? result.title,
        url: result.url,
        snippet: result.content,
        rawContent: extracted?.rawContent,
        score: result.score,
        usedByTodoIds: [],
      };
      sources.push(source);
      byUrl.set(source.url, source);
    } else {
      source.title = extracted?.title ?? source.title;
      source.snippet = source.snippet ?? result.content;
      source.rawContent = extracted?.rawContent ?? source.rawContent;
      source.score = source.score ?? result.score;
    }

    if (!source.usedByTodoIds.includes(todoId)) {
      source.usedByTodoIds.push(todoId);
    }
    sourceIds.push(source.id);
  }

  return { sources, sourceIds };
}

function summarizeFinding(
  todoTitle: string,
  query: string,
  searchResults: Omit<SearchResult, "todoId">[],
): string {
  if (searchResults.length === 0) {
    return `For "${todoTitle}", the search query "${query}" returned no results.`;
  }

  const highlights = searchResults
    .slice(0, 3)
    .map((result) => result.content)
    .filter(Boolean)
    .join(" ");

  return `For "${todoTitle}", searched "${query}" and collected ${searchResults.length} source(s). ${highlights}`;
}

export function createResearchGraph(deps: ResearchGraphDependencies = {}) {
  const now = deps.now ?? (() => new Date().toISOString());
  const maxSearchResults = deps.maxSearchResults ?? DEFAULT_MAX_SEARCH_RESULTS;
  const maxExtractResults =
    deps.maxExtractResults ?? DEFAULT_MAX_EXTRACT_RESULTS;

  let defaultModel: ReturnType<typeof createOpenAIResearchModel> | undefined;
  let defaultTavily: ReturnType<typeof createTavilyService> | undefined;

  const getModel = () => {
    defaultModel ??= deps.model ?? createOpenAIResearchModel();
    return defaultModel;
  };

  const getTavily = () => {
    defaultTavily ??= deps.tavily ?? createTavilyService();
    return defaultTavily;
  };

  const supervisorNode: ResearchNode = async (state) => ({
    nextAction: decideNextAction(state as ResearchState),
  });

  const plannerNode: ResearchNode = async (state) => {
    const errors = [...state.errors];
    const limitations = [...state.limitations];
    let planOutput: PlannerOutput;

    try {
      planOutput = await getModel().plan(state.question);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`planner failed: ${message}`);
      limitations.push("Planner failed; used a single fallback research task.");
      planOutput = fallbackPlan(state.question);
    }

    let todos = state.todos;
    for (const task of planOutput.tasks) {
      const result = applyTodoOperation(
        todos,
        {
          type: "add",
          title: task.title,
          query: task.query,
          description: task.rationale,
        },
        now,
      );
      todos = result.todos;
    }

    return {
      todos,
      plan: planToLines(planOutput),
      errors,
      limitations,
    };
  };

  const researcherNode: ResearchNode = async (state) => {
    const todoItem =
      state.todos.find((item) => item.status === "in_progress") ??
      state.todos.find((item) => item.status === "pending");

    if (!todoItem) return {};

    let todos = applyTodoOperation(
      state.todos,
      {
        type: "update",
        id: todoItem.id,
        status: "in_progress",
        note: `Started at ${now()}.`,
      },
      now,
    ).todos;

    const errors = [...state.errors];
    const limitations = [...state.limitations];

    try {
      const searchOutput = await getTavily().search({
        query: todoItem.query,
        maxResults: maxSearchResults,
      });
      const urlsToExtract = searchOutput.results
        .slice(0, maxExtractResults)
        .map((result) => result.url);
      const extractOutput =
        urlsToExtract.length > 0
          ? await getTavily().extract({ urls: urlsToExtract })
          : { results: [], failedResults: [] };

      for (const failed of extractOutput.failedResults) {
        limitations.push(`Extract failed for ${failed.url}: ${failed.error}`);
      }

      const { sources, sourceIds } = ensureSourceIds(
        state.sources,
        searchOutput.results,
        extractOutput.results,
        todoItem.id,
      );

      const finding: ResearchFinding = {
        todoId: todoItem.id,
        todoTitle: todoItem.title,
        summary: summarizeFinding(
          todoItem.title,
          todoItem.query,
          searchOutput.results,
        ),
        sourceIds,
      };

      todos = applyTodoOperation(
        todos,
        {
          type: "complete",
          id: todoItem.id,
          note: `Collected ${sourceIds.length} source(s).`,
        },
        now,
      ).todos;

      return {
        todos,
        sources,
        findings: [...state.findings, finding],
        searchResults: [
          ...state.searchResults,
          ...searchOutput.results.map((result) => ({
            ...result,
            todoId: todoItem.id,
          })),
        ],
        errors,
        limitations,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`researcher failed for ${todoItem.id}: ${message}`);
      limitations.push(`Research task failed: ${todoItem.title}`);
      todos = applyTodoOperation(
        todos,
        {
          type: "update",
          id: todoItem.id,
          status: "failed",
          note: message,
        },
        now,
      ).todos;
      return { todos, errors, limitations };
    }
  };

  const synthesizerNode: ResearchNode = async (state) => {
    const synthesisInput = {
      question: state.question,
      todos: state.todos,
      findings: state.findings,
      sources: state.sources,
      limitations: state.limitations,
      errors: state.errors,
    };

    try {
      return {
        report: await getModel().synthesize(synthesisInput),
        completedAt: now(),
      };
    } catch (error) {
      return {
        report: renderFallbackReport(synthesisInput, error),
        completedAt: now(),
        errors: [
          ...state.errors,
          `synthesizer failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      };
    }
  };

  const routeAfterSupervisor = (state: ResearchGraphState) => {
    const action = state.nextAction ?? decideNextAction(state as ResearchState);
    if (action === "end") return END;
    return action;
  };

  return new StateGraph(ResearchStateAnnotation)
    .addNode("supervisor", supervisorNode)
    .addNode("planner", plannerNode)
    .addNode("researcher", researcherNode)
    .addNode("synthesizer", synthesizerNode)
    .addEdge(START, "supervisor")
    .addConditionalEdges("supervisor", routeAfterSupervisor, {
      plan: "planner",
      research: "researcher",
      synthesize: "synthesizer",
      [END]: END,
    })
    .addEdge("planner", "supervisor")
    .addEdge("researcher", "supervisor")
    .addEdge("synthesizer", "supervisor")
    .compile({ name: "deep_research" });
}

export const graph = createResearchGraph();
