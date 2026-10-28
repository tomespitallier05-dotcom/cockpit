"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setTaskDone } from "@/server/actions/tasks";
import { TaskRow } from "./task-board";
import type { TaskView } from "./task-dialog";

/** Today's top tasks, checkable in place; opening one goes to the task page. */
export function PriorityList({ tasks, timeZone }: { tasks: TaskView[]; timeZone: string }) {
  const router = useRouter();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const toggle = (item: TaskView, value: boolean) => {
    setDone((current) => ({ ...current, [item.id]: value }));
    startTransition(async () => {
      const result = await setTaskDone(item.id, value);
      if (!result.ok) {
        toast.error(result.error);
        setDone((current) => ({ ...current, [item.id]: !value }));
      } else if (value) {
        toast.success("Bien joué", { description: item.title });
      }
    });
  };

  return (
    <ul className="-mx-2 divide-y divide-border">
      {tasks.map((item) => (
        <TaskRow
          key={item.id}
          item={item}
          done={done[item.id] ?? false}
          timeZone={timeZone}
          showProject
          onToggle={toggle}
          onOpen={() => router.push(`/taches?tache=${item.id}`)}
        />
      ))}
    </ul>
  );
}
