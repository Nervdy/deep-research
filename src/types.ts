export interface TavilySearchInput {
  query: string;
  maxResults?: number;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score?: number | undefined;
  publishedDate?: string | undefined;
}

export interface TavilySearchOutput {
  query: string;
  results: TavilySearchResult[];
}

export interface TavilyService {
  search(input: TavilySearchInput): Promise<TavilySearchOutput>;
}

export interface ReportInput {
  title?: string | undefined;
  fileName?: string | undefined;
  content: string;
}

export interface ReportWriteResult {
  path: string;
  fileName: string;
  bytes: number;
}
