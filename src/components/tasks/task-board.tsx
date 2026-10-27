"use client";

import { CalendarIcon, ChevronDownIcon, Loader2Icon, PlusIcon, UserIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { ProjectIcon } from "@/components/project-icon";
import type { ContactOption, ProjectOption } from "@/components/pickers";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, dayKey, endOfLocalDay, shortDayLabel, toLocalDateValue } from "@/lib/dates";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/entry-catalog";
import { createTask, setTaskDone } from "@/server/actions/tasks";
import { TaskDialog, type TaskView } from "./task-dialog";

type GroupKey = "overdue" | "today" | "week" | "later" | "nodate" | "done";

const GROUP_LABELS: Record<GroupKey, string> = {
  overdue: "En retard",
  today: "Aujourd'hui",
  week: "7 prochains jours",
  later: "Plus tard",
  nodate: "Sans échéance",
  done: "Terminées récemment",
};

type DueChoice = "none" | "today" | "tomorrow" | "week";

/** The task list used on /taches, in projects and on contact pages. */
export function TaskBoard({
  tasks,
  projects,
  contacts,
  timeZone,
  defaultProjectId,
  defaultContactId,
  showProject = true,
  focusTaskId,
  autoFocusNew = false,
}: {
  tasks: TaskView[];
  projects: ProjectOption[];
  contacts: ContactOption[];
  timeZone: string;
  defaultProjectId?: string;
  /** New tasks are promised to this contact (contact pages). */
  defaultContactId?: string;
  showProject?: boolean;
  focusTaskId?: string;
  autoFocusNew?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState<DueChoice>("none");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [doneOverrides, setDoneOverrides] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<TaskView | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [adding, startAdding] = useTransition();
  const [, startToggle] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setDoneOverrides({}), [tasks]);
  useEffect(() => {
    if (autoFocusNew) input.current?.focus();
  }, [autoFocusNew]);
  useEffect(() => {
    if (focusTaskId) setEditing(tasks.find((item) => item.id === focusTaskId) ?? null);
  }, [focusTaskId, tasks]);

  const groups = useMemo(() => {
    const now = new Date();
    const today = dayKey(now, timeZone);
    const weekEnd = dayKey(addDays(now, 7), timeZone);
    const map: Record<GroupKey, TaskView[]> = { overdue: [], today: [], week: [], later: [], nodate: [], done: [] };
    for (const item of tasks) {
      const done = doneOverrides[item.id] ?? (item.status === "done" || item.status === "cancelled");
      if (done) map.done.push(item);
      else if (!item.dueAt) map.nodate.push(item);
      else {
        const key = dayKey(item.dueAt, timeZone);
        if (key < today) map.overdue.push(item);
        else if (key === today) map.today.push(item);
        else if (key <= weekEnd) map.week.push(item);
        else map.later.push(item);
      }
    }
    return map;
  }, [tasks, doneOverrides, timeZone]);

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const now = new Date();
    const dueAt =
      due === "today"
        ? endOfLocalDay(toLocalDateValue(now))
        : due === "tomorrow"
          ? endOfLocalDay(toLocalDateValue(addDays(now, 1)))
          : due === "week"
            ? endOfLocalDay(toLocalDateValue(addDays(now, 7)))
            : null;
    startAdding(async () => {
      const result = await createTask({
        title,
        dueAt,
        priority,
        projectId: defaultProjectId ?? null,
        promisedToContactId: defaultContactId ?? null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTitle("");
      input.current?.focus();
    });
  };

  const toggle = (item: TaskView, done: boolean) => {
    setDoneOverrides((current) => ({ ...current, [item.id]: done }));
    startToggle(async () => {
      const result = await setTaskDone(item.id, done);
      if (!result.ok) {
        toast.error(result.error);
        setDoneOverrides((current) => ({ ...current, [item.id]: !done }));
      }
    });
  };

  const openCount = tasks.length - groups.done.length;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={add} className="surface flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 px-2">
          {adding ? <Loader2Icon className="size-4 animate-spin text-subtle" /> : <PlusIcon className="size-4 text-subtle" />}
          <input
            ref={input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ajouter une tâche et appuyer sur Entrée"
            aria-label="Nouvelle tâche"
            className="h-9 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-subtle"
          />
        </div>
        <div className="flex items-center gap-2 px-1 pb-1 sm:p-0">
          <Select value={due} onValueChange={(value) => setDue(value as DueChoice)}>
            <SelectTrigger size="sm" className="w-36">
              <CalendarIcon className="size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sans échéance</SelectItem>
              <SelectItem value="today">Aujourd&apos;hui</SelectItem>
              <SelectItem value="tomorrow">Demain</SelectItem>
              <SelectItem value="week">Dans 7 jours</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
            <SelectTrigger size="sm" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TASK_PRIORITIES) as TaskPriority[]).map((key) => (
                <SelectItem key={key} value={key}>
                  <span className="size-2 rounded-full" style={{ backgroundColor: TASK_PRIORITIES[key].color }} />
                  {key === "none" ? "Priorité" : TASK_PRIORITIES[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </form>

      {openCount === 0 && groups.done.length === 0 ? (
        <p className="px-1 text-[13px] text-subtle">Aucune tâche ici. Les actions décidées en appel méritent d&apos;y être.</p>
      ) : null}

      {(["overdue", "today", "week", "later", "nodate"] as GroupKey[]).map((key) =>
        groups[key].length ? (
          <TaskGroup
            key={key}
            label={GROUP_LABELS[key]}
            tone={key === "overdue" ? "danger" : undefined}
            items={groups[key]}
            timeZone={timeZone}
            showProject={showProject}
            isDone={(item) => doneOverrides[item.id] ?? item.status === "done"}
            onToggle={toggle}
            onOpen={setEditing}
          />
        ) : null,
      )}

      {groups.done.length ? (
        <div>
          <button
            type="button"
            onClick={() => setShowDone((value) => !value)}
            className="mb-2 flex items-center gap-1.5 px-1 text-[12px] font-medium text-subtle hover:text-muted-foreground"
          >
            <ChevronDownIcon className={cn("size-3.5 transition-transform", !showDone && "-rotate-90")} />
            {GROUP_LABELS.done} · {groups.done.length}
          </button>
          {showDone ? (
            <TaskGroup
              items={groups.done}
              timeZone={timeZone}
              showProject={showProject}
              isDone={(item) => doneOverrides[item.id] ?? true}
              onToggle={toggle}
              onOpen={setEditing}
            />
          ) : null}
        </div>
      ) : null}

      <TaskDialog task={editing} projects={projects} contacts={contacts} onClose={() => setEditing(null)} />
    </div>
  );
}

function TaskGroup({
  label,
  tone,
  items,
  timeZone,
  showProject,
  isDone,
  onToggle,
  onOpen,
}: {
  label?: string;
  tone?: "danger";
  items: TaskView[];
  timeZone: string;
  showProject: boolean;
  isDone: (item: TaskView) => boolean;
  onToggle: (item: TaskView, done: boolean) => void;
  onOpen: (item: TaskView) => void;
}) {
  return (
    <section>
      {label ? (
        <h3 className={cn("mb-2 px-1 text-[12px] font-medium", tone === "danger" ? "text-destructive" : "text-subtle")}>
          {label} · {items.length}
        </h3>
      ) : null}
      <ul className="surface divide-y divide-border overflow-hidden">
        {items.map((item) => (
          <TaskRow
            key={item.id}
            item={item}
            done={isDone(item)}
            timeZone={timeZone}
            showProject={showProject}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}

export function TaskRow({
  item,
  done,
  timeZone,
  showProject,
  onToggle,
  onOpen,
}: {
  item: TaskView;
  done: boolean;
  timeZone: string;
  showProject: boolean;
  onToggle: (item: TaskView, done: boolean) => void;
  onOpen: (item: TaskView) => void;
}) {
  const overdue = !done && item.dueAt && dayKey(item.dueAt, timeZone) < dayKey(new Date(), timeZone);
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.02]">
      <Checkbox
        checked={done}
        onCheckedChange={(checked) => onToggle(item, checked === true)}
        aria-label={done ? `Rouvrir « ${item.title} »` : `Terminer « ${item.title} »`}
        className="size-[18px] rounded-full"
      />
      <button type="button" onClick={() => onOpen(item)} className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none">
        {item.priority !== "none" ? (
          <span
            aria-label={`Priorité ${TASK_PRIORITIES[item.priority].label}`}
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: TASK_PRIORITIES[item.priority].color }}
          />
        ) : null}
        <span className={cn("truncate text-[13.5px]", done ? "text-subtle line-through" : "text-foreground")}>{item.title}</span>
      </button>
      <span className="flex shrink-0 items-center gap-2.5 text-[11.5px] text-subtle">
        {item.promisedToName ? (
          <span className="hidden items-center gap-1 sm:inline-flex">
            <UserIcon className="size-3" /> {item.promisedToName}
          </span>
        ) : null}
        {showProject && item.projectName ? (
          <span className="hidden items-center gap-1.5 md:inline-flex">
            <ProjectIcon icon={item.projectIcon ?? "folder"} color={item.projectColor ?? "slate"} size="xs" />
            <span className="max-w-28 truncate">{item.projectName}</span>
          </span>
        ) : null}
        {item.dueAt ? (
          <span className={cn("tabular-nums", overdue && "text-destructive")}>{shortDayLabel(item.dueAt, timeZone)}</span>
        ) : null}
      </span>
    </li>
  );
}
