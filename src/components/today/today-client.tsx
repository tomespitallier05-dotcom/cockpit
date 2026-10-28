"use client";

import { CalendarPlusIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshBrief } from "@/server/actions/brief";
import { prepareCallFromEvent } from "@/server/actions/google";

export function RefreshBriefButton({ ai }: { ai: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="xs"
      className="text-subtle"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await refreshBrief();
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
      {ai ? "Réécrire avec l'IA" : "Actualiser"}
    </Button>
  );
}

/** Creates the call entry for a calendar event (once), then opens it. */
export function PrepareEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await prepareCallFromEvent(eventId);
          if (!result.ok) return void toast.error(result.error);
          router.push(`/entrees/${result.data.entryId}`);
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <CalendarPlusIcon />}
      Préparer
    </Button>
  );
}
