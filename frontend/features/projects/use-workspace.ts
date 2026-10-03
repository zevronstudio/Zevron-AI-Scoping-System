"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import type { Project, ProjectSummary, Scope, Turn } from "@/types/project";

const selectionKey = "zevron.current-project";
function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(selectionKey, id);
    else localStorage.removeItem(selectionKey);
  } catch {
    /* Cookie persistence remains available. */
  }
}

export function useWorkspace() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"discovery" | "brief">("discovery");
  const lock = useRef(false);
  const pending = useRef<{
    projectId: string;
    body: Turn;
    scope: boolean;
  } | null>(null);
  const newProjectId = useRef<string | null>(null);
  const initialized = useRef(false);

  const accept = useCallback((value: Project) => {
    setProject(value);
    remember(value.id);
    setProjects((previous) => [
      value,
      ...previous.filter((item) => item.id !== value.id),
    ]);
  }, []);

  const boot = useCallback(async () => {
    try {
      await api.session();
      const [items, health] = await Promise.all([api.list(), api.health()]);
      setProjects(items);
      setAvailable(health.discovery_available);
      setError("");
      let current: string | null = null;
      try {
        current = localStorage.getItem(selectionKey);
      } catch {
        /* Optional convenience only. */
      }
      if (current && items.some((item) => item.id === current))
        setProject(await api.get(current));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open the workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      void boot();
    }
  }, [boot]);

  async function select(id: string) {
    if (lock.current) return;
    lock.current = true;
    setLoading(true);
    setError("");
    try {
      accept(await api.get(id));
      setDraft("");
      setTab("discovery");
      pending.current = null;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      lock.current = false;
      setLoading(false);
    }
  }

  function startNew() {
    if (lock.current) return;
    setProject(null);
    remember(null);
    setDraft("");
    setError("");
    setTab("discovery");
    pending.current = null;
    newProjectId.current = null;
  }

  async function send(content: string, scope = false, section?: keyof Scope) {
    const trimmed = content.trim();
    if (lock.current || !trimmed) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setDraft("");
    const previousProject = project;

    try {
      let current = project;
      if (!current) {
        newProjectId.current ??= crypto.randomUUID();
        current = await api.create(newProjectId.current);
        accept(current);
      }

      if (!scope && current) {
        const optimisticMsg = {
          id: `opt-${crypto.randomUUID()}`,
          role: "user" as const,
          content: trimmed,
          created_at: new Date().toISOString(),
          questions: [],
        };
        setProject({
          ...current,
          messages: [...current.messages, optimisticMsg],
        });
      }

      const previous = pending.current;
      const body =
        previous &&
        previous.projectId === current.id &&
        previous.body.content === trimmed &&
        previous.scope === scope &&
        previous.body.section === section
          ? previous.body
          : {
              request_id: crypto.randomUUID(),
              content: trimmed,
              ...(section ? { section } : {}),
            };
      pending.current = { projectId: current.id, body, scope };
      const updated = await api.turn(current.id, body, scope);
      accept(updated);
      pending.current = null;
      if (
        updated.scopes.length &&
        updated.scopes[0]?.version !== current.scopes[0]?.version
      )
        setTab("brief");
      return true;
    } catch (err) {
      setError((err as Error).message);
      setDraft(trimmed);
      if (previousProject) {
        setProject(previousProject);
      }
      return false;
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function rename(title: string) {
    if (!project || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      accept(await api.rename(project.id, title));
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (!project || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await api.remove(project.id);
      setProjects((items) => items.filter((item) => item.id !== project.id));
      lock.current = false;
      startNew();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return {
    projects,
    project,
    loading,
    busy,
    available,
    error,
    draft,
    setDraft,
    tab,
    setTab,
    boot,
    select,
    startNew,
    send,
    rename,
    remove,
    retry: () => {
      const p = pending.current;
      if (p) return send(p.body.content, p.scope, p.body.section);
      setLoading(true);
      return boot();
    },
  };
}
