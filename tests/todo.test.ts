import assert from "node:assert/strict";
import test from "node:test";
import { applyTodoOperation } from "../src/tools/todo.js";
import type { TodoItem } from "../src/types.js";

const now = () => "2026-05-06T00:00:00.000Z";

test("todo tool adds, updates, completes, and lists items", () => {
  let todos: TodoItem[] = [];

  const added = applyTodoOperation(
    todos,
    { type: "add", title: "Find sources", query: "RAG vs long context" },
    now,
  );
  todos = added.todos;
  assert.equal(todos.length, 1);
  assert.equal(todos[0]?.id, "todo-1");
  assert.equal(todos[0]?.status, "pending");

  const updated = applyTodoOperation(
    todos,
    {
      type: "update",
      id: "todo-1",
      status: "in_progress",
      note: "started",
    },
    now,
  );
  todos = updated.todos;
  assert.equal(todos[0]?.status, "in_progress");
  assert.deepEqual(todos[0]?.notes, ["started"]);

  const completed = applyTodoOperation(
    todos,
    { type: "complete", id: "todo-1", note: "done" },
    now,
  );
  todos = completed.todos;
  assert.equal(todos[0]?.status, "done");
  assert.deepEqual(todos[0]?.notes, ["started", "done"]);

  const listed = applyTodoOperation(todos, { type: "list" }, now);
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0]?.id, "todo-1");
});

test("todo tool rejects unknown ids", () => {
  assert.throws(
    () => applyTodoOperation([], { type: "complete", id: "todo-404" }, now),
    /Todo not found/,
  );
});
