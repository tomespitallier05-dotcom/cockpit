"use client";

import { CheckIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import type { ProjectOption } from "@/components/pickers";
import { ProjectIcon } from "@/components/project-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { endOfLocalDay, toLocalDateValue } from "@/lib/dates";
import { CONTACT_RELATIONSHIPS, type ContactRelationship } from "@/lib/entry-catalog";
import { createContact, updateContact } from "@/server/actions/contacts";

export type EditableContact = {
  id: string;
  name: string;
  role: string | null;
  relationship: ContactRelationship;
  company: string | null;
  email: string | null;
  phone: string | null;
  handles: { instagram?: string; discord?: string; whatsapp?: string };
  notes: string | null;
  nextInteractionAt: Date | null;
  projectIds: string[];
};

export function ContactDialog({
  open,
  contact,
  projects,
  onClose,
}: {
  open: boolean;
  contact: EditableContact | null;
  projects: ProjectOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    role: "",
    relationship: "other" as ContactRelationship,
    company: "",
    email: "",
    phone: "",
    instagram: "",
    discord: "",
    whatsapp: "",
    notes: "",
    next: "",
  });
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      name: contact?.name ?? "",
      role: contact?.role ?? "",
      relationship: contact?.relationship ?? "other",
      company: contact?.company ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      instagram: contact?.handles.instagram ?? "",
      discord: contact?.handles.discord ?? "",
      whatsapp: contact?.handles.whatsapp ?? "",
      notes: contact?.notes ?? "",
      next: contact?.nextInteractionAt ? toLocalDateValue(contact.nextInteractionAt) : "",
    });
    setProjectIds(contact?.projectIds ?? []);
  }, [open, contact]);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const payload = {
        name: form.name,
        role: form.role,
        relationship: form.relationship,
        company: form.company,
        email: form.email,
        phone: form.phone,
        handles: { instagram: form.instagram.replace(/^@/, ""), discord: form.discord, whatsapp: form.whatsapp },
        notes: form.notes,
        nextInteractionAt: form.next ? endOfLocalDay(form.next) : null,
        projectIds,
      };
      const result = contact ? await updateContact(contact.id, payload) : await createContact(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      toast.success(contact ? "Contact mis à jour" : "Contact ajouté");
      if (!contact && result.data) router.push(`/contacts/${result.data.id}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? null : onClose())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{contact ? "Modifier le contact" : "Nouveau contact"}</DialogTitle>
            <DialogDescription>Mentor, client, fournisseur ou partenaire.</DialogDescription>
          </DialogHeader>

          <Input placeholder="Nom" value={form.name} onChange={set("name")} className="h-10 text-[15px]" autoFocus required />

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CONTACT_RELATIONSHIPS) as ContactRelationship[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={form.relationship === key}
                onClick={() => setForm((current) => ({ ...current, relationship: key }))}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                  form.relationship === key ? "border-primary/60 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {CONTACT_RELATIONSHIPS[key]}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Rôle" id="c-role"><Input id="c-role" placeholder="Coach achat-revente" value={form.role} onChange={set("role")} /></Field>
            <Field label="Entreprise" id="c-company"><Input id="c-company" value={form.company} onChange={set("company")} /></Field>
            <Field label="Email" id="c-email"><Input id="c-email" type="email" value={form.email} onChange={set("email")} /></Field>
            <Field label="Téléphone" id="c-phone"><Input id="c-phone" type="tel" value={form.phone} onChange={set("phone")} /></Field>
            <Field label="Instagram" id="c-ig"><Input id="c-ig" placeholder="@pseudo" value={form.instagram} onChange={set("instagram")} /></Field>
            <Field label="Discord" id="c-discord"><Input id="c-discord" placeholder="pseudo" value={form.discord} onChange={set("discord")} /></Field>
            <Field label="WhatsApp" id="c-wa"><Input id="c-wa" type="tel" placeholder="+33…" value={form.whatsapp} onChange={set("whatsapp")} /></Field>
            <Field label="Prochaine interaction" id="c-next">
              <Input id="c-next" type="date" value={form.next} onChange={set("next")} className="[color-scheme:dark]" />
            </Field>
          </div>

          {projects.length ? (
            <div className="flex flex-col gap-2">
              <Label>Projets</Label>
              <div className="flex flex-wrap gap-1.5">
                {projects.map((project) => {
                  const selected = projectIds.includes(project.id);
                  return (
                    <button
                      key={project.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setProjectIds((current) => (selected ? current.filter((id) => id !== project.id) : [...current, project.id]))
                      }
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1.5 text-[12.5px] transition-colors",
                        selected ? "border-primary/60 bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {selected ? <CheckIcon className="size-3.5" /> : <ProjectIcon icon={project.icon} color={project.color} size="xs" />}
                      {project.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <Field label="Notes" id="c-notes">
            <Textarea id="c-notes" rows={3} placeholder="Comment vous vous êtes connus, ce qui compte pour cette personne…" value={form.notes} onChange={set("notes")} />
          </Field>

          <p aria-live="polite" className="min-h-4 text-[12.5px] text-destructive">{error}</p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={pending || !form.name.trim()}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {contact ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
