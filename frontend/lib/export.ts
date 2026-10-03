import type { Scope } from "@/types/project";

export const sectionLabels: Record<keyof Scope, string> = {
  executive_summary: "Executive summary",
  business_problem: "Business problem",
  proposed_solution: "Proposed solution",
  target_users: "Target users",
  features: "Core features",
  user_roles: "User roles",
  user_flows: "Core user flows",
  functional_requirements: "Functional requirements",
  non_functional_requirements: "Quality requirements",
  technical_architecture: "Technical approach",
  suggested_stack: "Suggested stack",
  integrations: "Integrations",
  modules: "Project modules",
  complexity: "Complexity",
  assumptions: "Assumptions",
  open_questions: "Open questions",
  future_enhancements: "Future enhancements",
};

export function scopeMarkdown(title: string, scope: Scope): string {
  const sections = (Object.keys(sectionLabels) as (keyof Scope)[]).map(
    (key) => {
      const value = scope[key];
      let body: string;
      if (typeof value === "string") body = value;
      else if (Array.isArray(value))
        body =
          value
            .map((item) => {
              if (typeof item === "string") return `- ${item}`;
              if ("items" in item)
                return `### ${item.name}\n${item.items.map((v) => `- ${v}`).join("\n")}`;
              return `- **${item.name}:** ${item.purpose}`;
            })
            .join("\n") || "None identified.";
      else body = `${value.level.toUpperCase()} — ${value.reason}`;
      return `## ${sectionLabels[key]}\n\n${body}`;
    },
  );
  return `# ${title}\n\n${sections.join("\n\n")}\n`;
}

export function downloadBrief(title: string, scope: Scope) {
  const url = URL.createObjectURL(
    new Blob([scopeMarkdown(title, scope)], {
      type: "text/markdown;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "project"}-brief.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
