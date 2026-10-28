"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { ProjectPicker, type ContactOption, type ProjectOption } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { endOfLocalDay, toLocalDateValue } from "@/lib/dates";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskPriority, type TaskStatus } from "@/lib/entry-catalog";
import { deleteTask, updateTask } from "@/server/actions/tasks";

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: Date | null;
  estimateMinutes: number | null;
  actualMinutes: number | null;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
  projectIcon: string | null;
  promisedToContactId: string | null;
  promisedToName: string | null;
};

const NONE = "__none__";

export function TaskDialog({
  task,
  projects,
  contacts,
  onClose,
}: {
  task: TaskView | null;
  projects: ProjectOption[];
  contacts: ContactOption[];
  onClose: () => void;
}) {
  if (!task) return null;
  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <TaskForm key={task.id} task={task} projects={projects} contacts={contacts} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({
  task,
  projects,
  contacts,
  onClose,
}: {
  task: TaskView;
  projects: ProjectOption[];
  contacts: ContactOption[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [due, setDue] = useState(task.dueAt ? toLocalDateValue(task.dueAt) : "");
  const [projectId, setProjectId] = useState<string | null>(task.projectId);
  const [promisedTo, setPromisedTo] = useState<string>(task.promisedToContactId ?? NONE);
  const [estimate, setEstimate] = useState(task.estimateMinutes?.toString() ?? "");
  const [actual, setActual] = useState(task.actualMinutes?.toString() ?? "");
  const [pending, startTransition] = useTransition();

  const save = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateTask(task.id, {
        title,
        description: description || null,
        status,
        priority,
        dueAt: due ? endOfLocalDay(due) : null,
        projectId,
        promisedToContactId: promisedTo === NONE ? null : promisedTo,
        estimateMinutes: estimate ? Number(estimate) : null,
        actualMinutes: actual ? Number(actual) : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onClose();
    });
  };

  const remove = () =>
    startTransition(async () => {
      const result = await deleteTask(task.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast("Tâche supprimée");
      onClose();
    });

  return (
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="sr-only">Modifier la tâche</DialogTitle>
            <DialogDescription className="sr-only">Titre, échéance, priorité et projet.</DialogDescription>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-label="Titre"
              className="w-full bg-transparent pr-8 text-[17px] font-semibold text-foreground outline-none"
              required
            />
          </DialogHeader>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Détails, contexte, critère de fin…"
            rows={3}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TASK_STATUSES) as TaskStatus[]).map((key) => (
                    <SelectItem key={key} value={key}>{TASK_STATUSES[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TASK_PRIORITIES) as TaskPriority[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: TASK_PRIORITIES[key].color }} />
                      {TASK_PRIORITIES[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due">Échéance</Label>
              <Input id="task-due" type="date" value={due} onChange={(event) => setDue(event.target.value)} className="[color-scheme:dark]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Projet</Label>
              <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} emptyLabel="Aucun projet" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Promise à</Label>
              <Select value={promisedTo} onValueChange={setPromisedTo}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Personne</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                      {contact.role ? <span className="text-subtle"> · {contact.role}</span> : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-estimate">Temps estimé (min)</Label>
              <Input id="task-estimate" type="number" min={0} inputMode="numeric" value={estimate} onChange={(event) => setEstimate(event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-actual">Temps réel (min)</Label>
              <Input id="task-actual" type="number" min={0} inputMode="numeric" value={actual} onChange={(event) => setActual(event.target.value)} />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove} disabled={pending}>
              <Trash2Icon /> Supprimer
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
              <Button type="submit" disabled={pending || !title.trim()}>
                {pending ? <Loader2Icon className="animate-spin" /> : null}
                Enregistrer
              </Button>
            </div>
          </DialogFooter>
        </form>
  );
}
