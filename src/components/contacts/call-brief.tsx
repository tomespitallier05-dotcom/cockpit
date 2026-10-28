"use client";

import { ClipboardListIcon, Loader2Icon, WandSparklesIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shortDayLabel } from "@/lib/dates";
import { generateCallAgenda, getCallBrief, type CallBrief } from "@/server/actions/briefs";

/** "Prepare the call": what was promised, advice to report back on, last exchanges, an agenda. */
export function CallBriefButton({ contactId, timeZone, label = "Préparer l'appel" }: { contactId: string; timeZone: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState<CallBrief | null>(null);
  const [agenda, setAgenda] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [writing, startWriting] = useTransition();

  const show = () => {
    setOpen(true);
    startLoading(async () => {
      const result = await getCallBrief(contactId);
      if (!result.ok) return void toast.error(result.error);
      setBrief(result.data);
    });
  };

  const writeAgenda = () =>
    startWriting(async () => {
      const result = await generateCallAgenda(contactId);
      if (!result.ok) return void toast.error(result.error);
      setAgenda(result.data);
    });

  return (
    <>
      <Button variant="outline" size="sm" onClick={show}>
        <ClipboardListIcon />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Préparer l&apos;appel{brief ? ` avec ${brief.contact.name}` : ""}</DialogTitle>
            <DialogDescription>Ce que tu lui dois, ce que tu as appliqué de ses conseils, et où vous en étiez.</DialogDescription>
          </DialogHeader>
          {!brief || loading ? (
            <p className="flex items-center gap-2 py-6 text-[13px] text-subtle">
              <Loader2Icon className="size-3.5 animate-spin" /> Préparation…
            </p>
          ) : (
            <div className="grid gap-5 text-[13px]">
              <BriefSection title="Tes engagements envers lui" empty="Aucun engagement en cours.">
                {brief.promises.map((p) => (
                  <li key={p.id}>
                    <Link href={`/taches?tache=${p.id}`} className="text-foreground hover:underline">
                      {p.title}
                    </Link>
                    {p.dueAt ? <span className="text-subtle"> · {shortDayLabel(p.dueAt, timeZone)}</span> : null}
                  </li>
                ))}
              </BriefSection>
              <BriefSection title="Ses conseils : où tu en es" empty="Aucun conseil retenu récemment.">
                {brief.adviceToReport.map((a) => (
                  <li key={a.id}>
                    <span className={a.status === "applied" ? "text-success" : "text-foreground"}>
                      {a.status === "applied" ? "✓ " : "○ "}
                      {a.content}
                    </span>
                  </li>
                ))}
              </BriefSection>
              <BriefSection title="Décisions récentes" empty="Aucune décision enregistrée.">
                {brief.decisions.map((d) => (
                  <li key={d.id} className="text-foreground">
                    {d.content}
                  </li>
                ))}
              </BriefSection>
              <BriefSection title="Derniers échanges" empty="Aucun échange enregistré.">
                {brief.lastEntries.map((e) => (
                  <li key={e.id}>
                    <Link href={`/entrees/${e.id}`} className="text-foreground hover:underline">
                      {e.title}
                    </Link>
                    <span className="text-subtle"> · {shortDayLabel(e.occurredAt, timeZone)}</span>
                    {e.summary ? <p className="text-[12.5px] text-muted-foreground">{e.summary}</p> : null}
                  </li>
                ))}
              </BriefSection>
              <div className="rounded-xl border border-border bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[12.5px] font-medium text-foreground">Ordre du jour</h3>
                  <Button size="xs" variant="outline" onClick={writeAgenda} disabled={writing || !brief.aiAvailable}>
                    {writing ? <Loader2Icon className="animate-spin" /> : <WandSparklesIcon />}
                    {agenda ? "Régénérer" : "Proposer"}
                  </Button>
                </div>
                {agenda ? (
                  <div className="mt-3 text-[13px] text-muted-foreground">
                    <Markdown text={agenda} />
                  </div>
                ) : (
                  <p className="mt-2 text-[12.5px] text-subtle">
                    {brief.aiAvailable ? "L'IA propose 5 points à partir de ces données." : "Disponible quand ANTHROPIC_API_KEY est configurée."}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BriefSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section>
      <h3 className="text-[12px] font-medium tracking-wide text-subtle uppercase">{title}</h3>
      {children.length ? <ul className="mt-2 space-y-1.5">{children}</ul> : <p className="mt-2 text-[12.5px] text-subtle">{empty}</p>}
    </section>
  );
}
