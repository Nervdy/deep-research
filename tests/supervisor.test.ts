import assert from "node:assert/strict";
import test from "node:test";
import { decideNextAction } from "../src/graph.js";
import type { ResearchState } from "../src/types.js";

const baseState: ResearchState = {
  question: "q",
  todos: [],
  plan: [],
  searchResults: [],
  sources: [],
  findings: [],
  errors: [],
  limitations: [],
  nextAction: "plan",
};

test("supervisor plans when there are no todos", () => {
  assert.equal(decideNextAction(baseState), "plan");
});

test("supervisor researches when a todo is pending", () => {
  assert.equal(
    decideNextAction({
      ...baseState,
      todos: [
        {
          id: "todo-1",
          title: "Find sources",
          query: "sources",
          status: "pending",
          notes: [],
          createdAt: "now",
          updatedAt: "now",
        },
      ],
    }),
    "research",
  );
});

test("supervisor synthesizes after todos are terminal", () => {
  assert.equal(
    decideNextAction({
      ...baseState,
      todos: [
        {
          id: "todo-1",
          title: "Find sources",
          query: "sources",
          status: "done",
          notes: [],
          createdAt: "now",
          updatedAt: "now",
        },
      ],
    }),
    "synthesize",
  );
});

test("supervisor ends after report exists", () => {
  assert.equal(decideNextAction({ ...baseState, report: "done" }), "end");
});
