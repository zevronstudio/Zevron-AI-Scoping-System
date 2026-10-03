import { z } from "zod";

export const scopeSchema = z.object({
  executive_summary: z.string(),
  business_problem: z.string(),
  proposed_solution: z.string(),
  target_users: z.array(z.string()),
  features: z.array(z.object({ name: z.string(), items: z.array(z.string()) })),
  user_roles: z.array(z.string()),
  user_flows: z.array(z.string()),
  functional_requirements: z.array(z.string()),
  non_functional_requirements: z.array(z.string()),
  technical_architecture: z.string(),
  suggested_stack: z.array(z.object({ name: z.string(), purpose: z.string() })),
  integrations: z.array(z.string()),
  modules: z.array(z.string()),
  complexity: z.object({
    level: z.enum(["low", "medium", "high"]),
    reason: z.string(),
  }),
  assumptions: z.array(z.string()),
  open_questions: z.array(z.string()),
  future_enhancements: z.array(z.string()),
});
export type Scope = z.infer<typeof scopeSchema>;
export const stateSchema = z.object({
  project_type: z.string(),
  business_type: z.string(),
  business_goal: z.string(),
  target_users: z.array(z.string()),
  requested_features: z.array(z.string()),
  confirmed_requirements: z.array(z.string()),
  missing_requirements: z.array(z.string()),
  constraints: z.array(z.string()),
  integrations: z.array(z.string()),
  budget_range: z.string().nullable(),
  timeline_preference: z.string().nullable(),
  technical_preferences: z.array(z.string()),
  assumptions: z.array(z.string()),
  conversation_stage: z.enum([
    "initial_understanding",
    "clarification",
    "requirement_confirmation",
    "scope_generation",
    "completed",
  ]),
});
export const summarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.string(),
  stage: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  revision: z.number(),
});
export const projectSchema = summarySchema.extend({
  state: stateSchema,
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      questions: z.array(z.string()),
      created_at: z.string(),
    }),
  ),
  scopes: z.array(
    z.object({
      id: z.string(),
      version: z.number(),
      created_at: z.string(),
      data: scopeSchema,
    }),
  ),
  requirements: z.array(
    z.object({
      key: z.string(),
      category: z.string(),
      value: z.string(),
      status: z.enum(["confirmed", "assumed", "unresolved"]),
      source: z.string(),
    }),
  ),
});
export type Project = z.infer<typeof projectSchema>;
export type ProjectSummary = z.infer<typeof summarySchema>;
export type Turn = {
  request_id: string;
  content: string;
  section?: keyof Scope;
};
