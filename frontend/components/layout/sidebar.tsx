import { ArrowUpRight, FileText, Plus, X } from "lucide-react";
import { product } from "@/lib/config";
import type { ProjectSummary } from "@/types/project";
import { Button } from "@/components/ui/button";

type Props = {
  projects: ProjectSummary[];
  currentId?: string;
  disabled: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onClose?: () => void;
};
export function Sidebar({
  projects,
  currentId,
  disabled,
  onNew,
  onSelect,
  onClose,
}: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          Z
        </span>
        <div>
          {product.name}
          <small>BY {product.studio.toUpperCase()}</small>
        </div>
        {onClose && (
          <Button
            className="drawer-close"
            variant="ghost"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={18} />
          </Button>
        )}
      </div>
      <Button
        variant="primary"
        className="new-project"
        onClick={onNew}
        disabled={disabled}
      >
        <Plus size={17} /> New project
      </Button>
      <div className="sidebar-label">
        YOUR PROJECTS <span>{projects.length}</span>
      </div>
      <nav aria-label="Projects" className="project-nav">
        {projects.length ? (
          projects.map((item) => (
            <button
              key={item.id}
              className={`project-link ${currentId === item.id ? "is-current" : ""}`}
              disabled={disabled}
              onClick={() => onSelect(item.id)}
              aria-current={currentId === item.id ? "page" : undefined}
            >
              <FileText size={17} />
              <span>
                {item.title}
                <small>{item.status}</small>
              </span>
            </button>
          ))
        ) : (
          <p className="sidebar-empty">
            Your projects will appear here once you share an idea.
          </p>
        )}
      </nav>
      <div className="sidebar-note">
        <span className="eyebrow">A CLEARER START</span>
        <p>Good projects start with the right questions.</p>
        <span className="studio-signature">
          {product.studio}
          <ArrowUpRight size={15} aria-hidden="true" />
        </span>
      </div>
      <div className="guest-label">
        <span className="guest-avatar">G</span>
        <div>
          Guest workspace<small>Saved in this browser session</small>
        </div>
      </div>
    </aside>
  );
}
