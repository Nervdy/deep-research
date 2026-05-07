export const TODO_STATUSES = [
  "pending",
  "in_progress",
  "done",
  "failed",
] as const;

export type TodoStatus = (typeof TODO_STATUSES)[number];

export type SupervisorAction = "plan" | "research" | "synthesize" | "end";

export interface TodoItem {
  id: string;
  title: string;
  query: string;
  description?: string | undefined;
  status: TodoStatus;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  todoId: string;
  title: string;
  url: string;
  content: string;
  score?: number | undefined;
  publishedDate?: string | undefined;
}

export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  snippet?: string | undefined;
  rawContent?: string | undefined;
  score?: number | undefined;
  usedByTodoIds: string[];
}

export interface ResearchFinding {
  todoId: string;
  todoTitle: string;
  summary: string;
  sourceIds: string[];
}

export interface ResearchState {
  question: string;
  todos: TodoItem[];
  plan: string[];
  searchResults: SearchResult[];
  sources: ResearchSource[];
  findings: ResearchFinding[];
  report?: string;
  errors: string[];
  limitations: string[];
  nextAction: SupervisorAction;
  completedAt?: string;
}

export interface PlannerTask {
  title: string;
  query: string;
  rationale?: string | undefined;
}

export interface PlannerOutput {
  objective: string;
  tasks: PlannerTask[];
}

export interface SynthesisInput {
  question: string;
  todos: TodoItem[];
  findings: ResearchFinding[];
  sources: ResearchSource[];
  limitations: string[];
  errors: string[];
}

export interface ResearchModel {
  plan(question: string): Promise<PlannerOutput>;
  synthesize(input: SynthesisInput): Promise<string>;
}

export interface TavilySearchInput {
  query: string;
  maxResults?: number;
}

export interface TavilySearchOutput {
  query: string;
  results: Omit<SearchResult, "todoId">[];
}

export interface TavilyExtractInput {
  urls: string[];
}

export interface TavilyExtractResult {
  url: string;
  title?: string | undefined;
  rawContent: string;
}

export interface TavilyExtractOutput {
  results: TavilyExtractResult[];
  failedResults: Array<{ url: string; error: string }>;
}

export interface TavilyService {
  search(input: TavilySearchInput): Promise<TavilySearchOutput>;
  extract(input: TavilyExtractInput): Promise<TavilyExtractOutput>;
}

export interface ResearchGraphDependencies {
  model?: ResearchModel;
  tavily?: TavilyService;
  now?: () => string;
  maxSearchResults?: number;
  maxExtractResults?: number;
}
