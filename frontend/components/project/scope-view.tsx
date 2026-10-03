import { useState } from "react";
import { Copy, Download, FileText, Pencil, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { downloadBrief, scopeMarkdown, sectionLabels } from "@/lib/export";
import type { Project, Scope } from "@/types/project";

export function ScopeView({
  project,
  busy,
  onRevise,
  onGenerate,
}: {
  project: Project;
  busy: boolean;
  onRevise: (content: string, section: keyof Scope) => Promise<boolean>;
  onGenerate: () => void;
}) {
  const [version, setVersion] = useState<number | null>(null);
  const [editing, setEditing] = useState<keyof Scope | null>(null);
  const [instruction, setInstruction] = useState("");
  const [notice, setNotice] = useState("");
  const [revisionError, setRevisionError] = useState("");
  const selected =
    project.scopes.find((scope) => scope.version === version) ||
    project.scopes[0];
  if (!selected)
    return (
      <div className="brief-empty">
        <FileText size={32} strokeWidth={1.3} />
        <h2>Your brief starts with a conversation.</h2>
        <p>
          We’re collecting the information needed to prepare your project scope.
          Share your goal, audience, and the essentials first.
        </p>
        <Button
          disabled={busy || !project.messages.length}
          onClick={onGenerate}
        >
          Prepare a brief from what we know
        </Button>
      </div>
    );
  const isLatest = selected.version === project.scopes[0].version;
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        scopeMarkdown(project.title, selected.data),
      );
      setNotice("Brief copied to clipboard.");
    } catch {
      setNotice("Clipboard is unavailable. Use Download instead.");
    }
  }
  return (
    <div className="scope-view">
      <div className="brief-toolbar">
        <label>
          Version{" "}
          <select
            aria-label="Brief version"
            value={selected.version}
            onChange={(event) => setVersion(Number(event.target.value))}
          >
            {project.scopes.map((scope) => (
              <option key={scope.id} value={scope.version}>
                {scope.version}
                {scope.version === project.scopes[0].version ? " · Latest" : ""}
              </option>
            ))}
          </select>
        </label>
        <div>
          <Button variant="ghost" onClick={copy}>
            <Copy size={15} /> Copy
          </Button>
          <Button
            variant="ghost"
            onClick={() => downloadBrief(project.title, selected.data)}
          >
            <Download size={15} /> Download
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </Button>
        </div>
      </div>
      {notice && (
        <p className="export-notice" role="status">
          {notice}
        </p>
      )}
      {!isLatest && (
        <p className="inline-notice">
          You’re viewing an earlier version. Select the latest version to
          request changes.
        </p>
      )}
      {project.status !== "Scope Generated" && (
        <p className="inline-notice">
          Discovery has continued since this brief. Update the brief after
          confirming your latest requirements.
        </p>
      )}
      <header className="brief-heading">
        <span className="eyebrow accent">
          PROJECT BRIEF · VERSION {selected.version}
        </span>
        <h1>{project.title}</h1>
        <p>
          Prepared for review ·{" "}
          {new Date(`${selected.created_at}Z`).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>
      {(Object.keys(sectionLabels) as (keyof Scope)[]).map((key, index) => (
        <section className={`scope-section scope-section--${key}`} key={key}>
          <div className="scope-section-heading">
            <h2>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {sectionLabels[key]}
            </h2>
            {isLatest && (
              <Button
                variant="ghost"
                className="section-edit"
                aria-label={`Revise ${sectionLabels[key]}`}
                disabled={busy}
                onClick={() => {
                  setEditing(key);
                  setInstruction("");
                }}
              >
                <Pencil size={14} />
                <span>Revise</span>
              </Button>
            )}
          </div>
          <ScopeContent value={selected.data[key]} />
        </section>
      ))}
      <footer className="brief-footer">
        A working scope for discussion. Estimates and delivery commitments
        require studio review.
      </footer>
      {editing && (
        <Dialog
          title={`Revise ${sectionLabels[editing].toLowerCase()}`}
          onClose={() => {
            if (!busy) {
              setEditing(null);
              setRevisionError("");
            }
          }}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setRevisionError("");
              if (await onRevise(instruction, editing)) {
                setEditing(null);
                setVersion(null);
              } else {
                setRevisionError(
                  "The section could not be updated. Your instructions are preserved; please retry.",
                );
              }
            }}
          >
            <p>
              Describe the change you need. The advisor will update this section
              and keep the rest of the brief.
            </p>
            {revisionError && <p role="alert">{revisionError}</p>}
            <label htmlFor="revision">Your revision</label>
            <textarea
              id="revision"
              autoFocus
              rows={5}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              required
              maxLength={6000}
              disabled={busy}
            />
            <div className="dialog-actions">
              <Button
                disabled={busy}
                type="button"
                onClick={() => {
                  setEditing(null);
                  setRevisionError("");
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" disabled={busy || !instruction.trim()}>
                {busy ? "Revising…" : "Update section"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

export function ScopeContent({ value }: { value: Scope[keyof Scope] }) {
  if (typeof value === "string")
    return <p className="scope-prose">{value || "Not specified."}</p>;
  if (Array.isArray(value)) {
    if (!value.length)
      return <p className="muted">None identified for this scope.</p>;
    if (typeof value[0] === "string")
      return (
        <ul className="requirement-list">
          {(value as string[]).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    return (
      <div className="feature-groups">
        {value.map(
          (item, i) =>
            typeof item === "object" && (
              <div key={i}>
                <h3>{item.name}</h3>
                {"items" in item ? (
                  <ul className="requirement-list">
                    {item.items.map((entry, j) => (
                      <li key={j}>{entry}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{item.purpose}</p>
                )}
              </div>
            ),
        )}
      </div>
    );
  }
  return (
    <div className="complexity">
      <span className="status-badge">{value.level} complexity</span>
      <p>{value.reason}</p>
    </div>
  );
}
