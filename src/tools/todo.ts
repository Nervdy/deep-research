import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { TodoItem, TodoStatus } from "../types.js";

const addSchema = z.object({
  type: z.literal("add"),
  title: z.string().min(1),
  query: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
});

const updateSchema = z.object({
  type: z.literal("update"),
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(["pending", "in_progress", "done", "failed"]).optional(),
  note: z.string().min(1).optional(),
});

const completeSchema = z.object({
  type: z.literal("complete"),
  id: z.string().min(1),
  note: z.string().min(1).optional(),
});

const listSchema = z.object({
  type: z.literal("list"),
});

export const TodoOperationSchema = z.discriminatedUnion("type", [
  addSchema,
  updateSchema,
  completeSchema,
  listSchema,
]);

export type TodoOperation = z.infer<typeof TodoOperationSchema>;

export interface TodoOperationResult {
  todos: TodoItem[];
  items: TodoItem[];
  message: string;
}

function nextTodoId(todos: TodoItem[]): string {
  let index = todos.length + 1;
  const existing = new Set(todos.map((todoItem) => todoItem.id));
  while (existing.has(`todo-${index}`)) {
    index += 1;
  }
  return `todo-${index}`;
}

function replaceTodo(todos: TodoItem[], next: TodoItem): TodoItem[] {
  return todos.map((todoItem) => (todoItem.id === next.id ? next : todoItem));
}

function requireTodo(todos: TodoItem[], id: string): TodoItem {
  const todoItem = todos.find((candidate) => candidate.id === id);
  if (!todoItem) {
    throw new Error(`Todo not found: ${id}`);
  }
  return todoItem;
}

export function applyTodoOperation(
  todos: TodoItem[],
  operation: TodoOperation,
  now: () => string = () => new Date().toISOString(),
): TodoOperationResult {
  const timestamp = now();

  if (operation.type === "list") {
    return {
      todos,
      items: todos,
      message: `Listed ${todos.length} todo item(s).`,
    };
  }

  if (operation.type === "add") {
    const item: TodoItem = {
      id: nextTodoId(todos),
      title: operation.title,
      query: operation.query ?? operation.title,
      description: operation.description,
      status: "pending",
      notes: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const nextTodos = [...todos, item];
    return {
      todos: nextTodos,
      items: [item],
      message: `Added ${item.id}.`,
    };
  }

  if (operation.type === "complete") {
    const existing = requireTodo(todos, operation.id);
    const notes = operation.note
      ? [...existing.notes, operation.note]
      : existing.notes;
    const next: TodoItem = {
      ...existing,
      status: "done",
      notes,
      updatedAt: timestamp,
    };
    return {
      todos: replaceTodo(todos, next),
      items: [next],
      message: `Completed ${next.id}.`,
    };
  }

  const existing = requireTodo(todos, operation.id);
  const notes = operation.note
    ? [...existing.notes, operation.note]
    : existing.notes;
  const next: TodoItem = {
    ...existing,
    title: operation.title ?? existing.title,
    query: operation.query ?? existing.query,
    description: operation.description ?? existing.description,
    status: (operation.status ?? existing.status) as TodoStatus,
    notes,
    updatedAt: timestamp,
  };

  return {
    todos: replaceTodo(todos, next),
    items: [next],
    message: `Updated ${next.id}.`,
  };
}

export function createTodoListTool(
  getTodos: () => TodoItem[],
  setTodos: (todos: TodoItem[]) => void,
  now: () => string = () => new Date().toISOString(),
) {
  return tool(
    async (input: TodoOperation) => {
      const result = applyTodoOperation(getTodos(), input, now);
      setTodos(result.todos);
      return JSON.stringify(result, null, 2);
    },
    {
      name: "todo_list",
      description:
        "Manage the current research todo list. Supports add, update, complete, and list operations.",
      schema: TodoOperationSchema,
    },
  );
}
