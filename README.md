# deep-research

Learning-oriented deep research agent built with Bun, TypeScript, LangChain `createAgent`, and Tavily.

## Setup

```sh
cp .env.example .env
# Fill OPENAI_API_KEY and TAVILY_API_KEY.
npm install
```

The runtime scripts are written for Bun:

```sh
bun run research -- "Compare RAG and long context for enterprise search"
bun run research -- "Compare RAG and long context" --output-dir output
bun run studio
bun test
bun run typecheck
```

The agent uses LangChain's `createAgent` ReAct loop. It receives a Tavily search tool and a `write_report` tool; the model decides when to search and saves the final Markdown report under `output/` by calling the report tool.
