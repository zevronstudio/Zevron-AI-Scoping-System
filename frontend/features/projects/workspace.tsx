"use client";
import { useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Menu,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useWorkspace } from "./use-workspace";
import { Sidebar } from "@/components/layout/sidebar";
import { ContextPanel } from "@/components/project/context-panel";
import { ScopeView } from "@/components/project/scope-view";
import { IdeaStart } from "@/components/agent/idea-start";
import { Composer } from "@/components/agent/composer";
import { Conversation } from "@/components/agent/conversation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Workspace() {
  const w = useWorkspace();
  const drawer = useRef<HTMLDialogElement>(null);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [name, setName] = useState("");

  const disabled = w.busy || w.loading;

  const sidebar = (
    <Sidebar
      projects={w.projects}
      currentId={w.project?.id}
      disabled={disabled}
      onNew={() => {
        w.startNew();
        drawer.current?.close();
      }}
      onSelect={(id) => {
        void w.select(id);
        drawer.current?.close();
      }}
    />
  );

  const generate = () =>
    void w.send(
      "Please prepare a project brief from our confirmed requirements. Clearly label assumptions and unresolved details.",
      true,
    );

  const discoveryDisabled = disabled || w.available !== true;

  const handleProjectDropdown = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === "NEW_PROJECT") {
      w.startNew();
    } else if (value && value !== w.project?.id) {
      void w.select(value);
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-main">
        Skip to workspace
      </a>
      <div className="desktop-sidebar">{sidebar}</div>
      <dialog
        className="mobile-drawer"
        ref={drawer}
        aria-label="Project navigation"
      >
        <Button
          className="drawer-dismiss"
          variant="ghost"
          onClick={() => drawer.current?.close()}
          aria-label="Close navigation"
        >
          <X size={18} />
        </Button>
        {sidebar}
      </dialog>

      <div className="workspace-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              className="menu-button"
              aria-label="Open navigation"
              onClick={() => drawer.current?.showModal()}
            >
              <Menu size={18} />
            </Button>
            <span className="breadcrumb-root">Workspace</span>
            <ChevronRight size={13} className="breadcrumb-divider" />

            {/* Quick Project Switcher Dropdown */}
            <div className="project-dropdown-wrapper">
              <select
                className="project-dropdown-select"
                aria-label="Select project"
                value={w.project?.id || "NEW_PROJECT"}
                onChange={handleProjectDropdown}
                disabled={disabled}
              >
                <option value="NEW_PROJECT">+ New Project</option>
                {w.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="dropdown-arrow-icon" />
            </div>

            {w.project && (
              <div className="topbar-project-actions">
                <span className="status-badge">{w.project.status}</span>
                <Button
                  variant="ghost"
                  className="icon-action-btn"
                  aria-label="Rename project"
                  disabled={disabled}
                  onClick={() => {
                    setName(w.project!.title);
                    setDialog("rename");
                  }}
                  title="Rename project"
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  className="icon-action-btn"
                  aria-label="Delete project"
                  disabled={disabled}
                  onClick={() => setDialog("delete")}
                  title="Delete project"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            )}
          </div>

          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>

        <div
          className="workspace-tabs"
          role="tablist"
          onKeyDown={(event) => {
            if (
              !w.project ||
              (event.target as HTMLElement).getAttribute("role") !== "tab"
            )
              return;
            if (
              ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "discovery"
                  : event.key === "End"
                    ? "brief"
                    : w.tab === "discovery"
                      ? "brief"
                      : "discovery";
              w.setTab(next);
              document.getElementById(`${next}-tab`)?.focus();
            }
          }}
          aria-label="Project views"
        >
          <button
            id="discovery-tab"
            role="tab"
            aria-controls="workspace-main"
            aria-selected={w.tab === "discovery"}
            tabIndex={w.tab === "discovery" ? 0 : -1}
            onClick={() => w.setTab("discovery")}
          >
            <MessageSquare size={15} /> Chat
          </button>
          <button
            id="brief-tab"
            role="tab"
            aria-controls="workspace-main"
            aria-selected={w.tab === "brief"}
            tabIndex={w.tab === "brief" ? 0 : -1}
            disabled={!w.project}
            onClick={() => w.setTab("brief")}
          >
            <FileText size={15} /> Project Brief
            {Boolean(w.project?.scopes.length) && <span className="tab-dot" />}
          </button>

          {w.project && w.tab === "discovery" && (
            <Button
              className="prepare-button"
              variant="primary"
              disabled={discoveryDisabled || !w.project.messages.length}
              onClick={generate}
            >
              {w.project.scopes.length ? "Update brief" : "Prepare brief"}
              <ChevronRight size={14} />
            </Button>
          )}
        </div>

        {w.error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{w.error}</span>
            <Button onClick={() => void w.retry()} disabled={disabled}>
              Retry
            </Button>
          </div>
        )}

        {w.available === false && (
          <div className="configuration-notice" role="status">
            The discovery advisor is not connected. Please verify the LLM API key in .env.
          </div>
        )}

        <div className={`workspace-body ${w.tab === "brief" ? "is-brief" : ""}`}>
          <main
            id="workspace-main"
            role="tabpanel"
            aria-labelledby={`${w.tab}-tab`}
            className="main-workspace"
          >
            {w.loading ? (
              <div className="loading-workspace" role="status">
                <div className="skeleton" />
                <div className="skeleton" />
                <p>Loading workspace…</p>
              </div>
            ) : w.tab === "brief" && w.project ? (
              <ScopeView
                key={w.project.id}
                project={w.project}
                busy={discoveryDisabled}
                onGenerate={generate}
                onRevise={(content, section) => w.send(content, true, section)}
              />
            ) : (
              <>
                {w.project?.messages.length ? (
                  <Conversation
                    messages={w.project.messages}
                    busy={w.busy}
                    onAnswer={(answerText) => {
                      w.setDraft((prev) =>
                        prev.trim() ? `${prev.trim()}\n${answerText}` : answerText,
                      );
                      document.getElementById("project-message")?.focus();
                    }}
                  />
                ) : (
                  <IdeaStart
                    disabled={discoveryDisabled}
                    onChoose={(value) => {
                      w.setDraft(value);
                      document.getElementById("project-message")?.focus();
                    }}
                  />
                )}
                <Composer
                  value={w.draft}
                  onChange={w.setDraft}
                  onSend={() => void w.send(w.draft)}
                  busy={w.busy}
                  disabled={discoveryDisabled}
                  hasMessages={Boolean(w.project?.messages.length)}
                />
              </>
            )}
          </main>

          <aside className="context-panel">
            <ContextPanel project={w.project} />
          </aside>
        </div>

        <details className="mobile-context">
          <summary>Project context & requirements</summary>
          <ContextPanel project={w.project} />
        </details>
      </div>

      {dialog === "rename" && (
        <Dialog
          title="Rename project"
          error={w.error}
          onClose={() => {
            if (!w.busy) setDialog(null);
          }}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (await w.rename(name)) setDialog(null);
            }}
          >
            <label htmlFor="project-title">Project name</label>
            <input
              id="project-title"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              required
              disabled={w.busy}
            />
            <div className="dialog-actions">
              <Button
                type="button"
                onClick={() => setDialog(null)}
                disabled={w.busy}
              >
                Cancel
              </Button>
              <Button variant="primary" disabled={w.busy || !name.trim()}>
                Save name
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {dialog === "delete" && (
        <Dialog
          title="Delete this project?"
          error={w.error}
          onClose={() => {
            if (!w.busy) setDialog(null);
          }}
        >
          <p>
            This permanently deletes “{w.project?.title}”, its conversation, and
            every brief version.
          </p>
          <div className="dialog-actions">
            <Button disabled={w.busy} onClick={() => setDialog(null)}>
              Keep project
            </Button>
            <Button
              variant="danger"
              disabled={w.busy}
              onClick={async () => {
                if (await w.remove()) setDialog(null);
              }}
            >
              Delete project
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
