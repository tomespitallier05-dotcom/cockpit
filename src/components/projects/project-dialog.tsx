"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { ProjectIcon, projectColor } from "@/components/project-icon";
import { useShell } from "@/components/shell/shell-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PROJECT_COLORS,
  PROJECT_ICON_NAMES,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  PROJECT_TEMPLATES,
  type ProjectColor,
  type ProjectIconName,
  type ProjectStatus,
  type ProjectTemplate,
} from "@/lib/project-catalog";
import { createProject, updateProject } from "@/server/actions/projects";

/** Create or edit a project. Mounted once in the shell; opened through useShell(). */
export function ProjectDialog() {
  const router = useRouter();
  const { projectDialog, closeProjectDialog } = useShell();
  const editing = projectDialog.project;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<ProjectTemplate>("blank");
  const [icon, setIcon] = useState<ProjectIconName>("folder");
  const [color, setColor] = useState<ProjectColor>("slate");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [touchedLook, setTouchedLook] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!projectDialog.open) return;
    setError(null);
    setTouchedLook(Boolean(editing));
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setTemplate(editing?.template ?? "blank");
    setIcon((editing?.icon as ProjectIconName) ?? "folder");
    setColor((editing?.color as ProjectColor) ?? "slate");
    setStatus(editing?.status ?? "active");
  }, [projectDialog.open, editing]);

  const chooseTemplate = (key: ProjectTemplate) => {
    setTemplate(key);
    // Until the icon or colour is picked by hand, they follow the template.
    if (!touchedLook) {
      setIcon(PROJECT_TEMPLATES[key].icon);
      setColor(PROJECT_TEMPLATES[key].color);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const payload = { name, description, template, icon, color };
      const result = editing
        ? await updateProject(editing.id, { ...payload, status })
        : await createProject(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      closeProjectDialog();
      toast.success(editing ? "Projet mis à jour" : "Projet créé");
      router.push(`/projets/${result.data.slug}`);
    });
  };

  return (
    <Dialog open={projectDialog.open} onOpenChange={(open) => (open ? null : closeProjectDialog())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le projet" : "Nouveau projet"}</DialogTitle>
            <DialogDescription>
              {editing ? "Nom, apparence et statut." : "Un espace autonome, organisé par son template."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3">
            <ProjectIcon icon={icon} color={color} size="lg" />
            <div className="flex-1">
              <Label htmlFor="project-name" className="sr-only">
                Nom
              </Label>
              <Input
                id="project-name"
                placeholder="Nom du projet"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-10 text-[15px]"
                autoFocus
                required
              />
            </div>
          </div>

          {!editing ? (
            <div className="flex flex-col gap-2">
              <Label>Template</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PROJECT_TEMPLATES) as ProjectTemplate[]).map((key) => {
                  const item = PROJECT_TEMPLATES[key];
                  const selected = key === template;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => chooseTemplate(key)}
                      aria-pressed={selected}
                      className={cn(
                        "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                        selected ? "border-primary/60 bg-primary/8" : "border-border hover:border-white/15 hover:bg-white/[0.02]",
                      )}
                    >
                      <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                        <ProjectIcon icon={item.icon} color={item.color} size="xs" />
                        {item.label}
                      </span>
                      <span className="text-[12px] leading-snug text-subtle">{item.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="En une phrase : de quoi s'agit-il ?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={280}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Icône</Label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_ICON_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-label={name}
                  aria-pressed={icon === name}
                  onClick={() => {
                    setIcon(name);
                    setTouchedLook(true);
                  }}
                  className={cn(
                    "rounded-lg p-1 ring-offset-2 ring-offset-popover transition",
                    icon === name ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100",
                  )}
                >
                  <ProjectIcon icon={name} color={color} size="md" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PROJECT_COLORS) as ProjectColor[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  aria-pressed={color === key}
                  onClick={() => {
                    setColor(key);
                    setTouchedLook(true);
                  }}
                  className="flex size-7 items-center justify-center rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: projectColor(key) }}
                >
                  {color === key ? <CheckIcon className="size-3.5 text-white" strokeWidth={3} /> : null}
                </button>
              ))}
            </div>
          </div>

          {editing ? (
            <div className="flex flex-col gap-2">
              <Label>Statut</Label>
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_STATUSES.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatus(key)}
                    aria-pressed={status === key}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                      status === key ? "border-primary/60 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {PROJECT_STATUS_LABELS[key]}
                  </button>
                ))}
              </div>
              {status === "archived" ? (
                <p className="text-[12px] text-subtle">Un projet archivé disparaît de la barre latérale ; rien n&apos;est supprimé.</p>
              ) : null}
            </div>
          ) : null}

          <p aria-live="polite" className="min-h-4 text-[12.5px] text-destructive">
            {error}
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeProjectDialog}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {editing ? "Enregistrer" : "Créer le projet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
