# deep-research

Learning-oriented deep research agent built with Bun, TypeScript, LangChain, LangGraph, and Tavily.

## Setup

```sh
cp .env.example .env
# Fill OPENAI_API_KEY and TAVILY_API_KEY.
npm install
```

The runtime scripts are written for Bun:

```sh
bun run research -- "Compare RAG and long context for enterprise search"
bun run studio
bun test
bun run typecheck
```

`bun run studio` starts the LangGraph local development server for LangSmith Studio. The same graph is used by the CLI and Studio.
