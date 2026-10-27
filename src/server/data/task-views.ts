import "server-only";
import type { TaskView } from "@/components/tasks/task-dialog";
import type { TaskItem } from "./tasks";

/** Narrows a task row to what the client needs. */
export function toTaskView(item: TaskItem): TaskView {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    status: item.status,
    priority: item.priority,
    dueAt: item.dueAt,
    estimateMinutes: item.estimateMinutes,
    actualMinutes: item.actualMinutes,
    projectId: item.projectId,
    projectName: item.projectName,
    projectColor: item.projectColor,
    projectIcon: item.projectIcon,
    promisedToContactId: item.promisedToContactId,
    promisedToName: item.promisedToName,
  };
}
