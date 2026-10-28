"use client";

import { AtSignIcon, MailIcon, PencilIcon, PhoneIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ContactDialog, type EditableContact } from "@/components/contacts/contact-dialog";
import type { ProjectOption } from "@/components/pickers";
import { initials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CONTACT_RELATIONSHIPS } from "@/lib/entry-catalog";
import { deleteContact } from "@/server/actions/contacts";

export function ContactHeader({
  contact,
  projects,
  actions,
}: {
  contact: EditableContact;
  projects: ProjectOption[];
  /** Extra buttons before Edit (e.g. prepare a call). */
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const links = [
    contact.email ? { href: `mailto:${contact.email}`, label: contact.email, icon: MailIcon } : null,
    contact.phone ? { href: `tel:${contact.phone.replace(/\s/g, "")}`, label: contact.phone, icon: PhoneIcon } : null,
    contact.handles.instagram
      ? { href: `https://instagram.com/${contact.handles.instagram}`, label: `@${contact.handles.instagram}`, icon: AtSignIcon }
      : null,
    contact.handles.whatsapp
      ? { href: `https://wa.me/${contact.handles.whatsapp.replace(/[^0-9]/g, "")}`, label: "WhatsApp", icon: PhoneIcon }
      : null,
    contact.handles.discord ? { href: null, label: `Discord : ${contact.handles.discord}`, icon: AtSignIcon } : null,
  ].filter((item) => item !== null);

  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#2a2f3d,#1b1e27)] text-lg font-semibold text-foreground/85">
        {initials(contact.name)}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{contact.name}</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          {[contact.role, contact.company].filter(Boolean).join(" · ") || CONTACT_RELATIONSHIPS[contact.relationship]}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
          <span className="rounded-full border border-border px-2.5 py-0.5 text-muted-foreground">
            {CONTACT_RELATIONSHIPS[contact.relationship]}
          </span>
          {links.map((link) =>
            link.href ? (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <link.icon className="size-3" /> {link.label}
              </a>
            ) : (
              <span key={link.label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-0.5 text-muted-foreground">
                <link.icon className="size-3" /> {link.label}
              </span>
            ),
          )}
        </div>
        {contact.notes ? <p className="mt-4 max-w-2xl text-[13.5px] whitespace-pre-line text-muted-foreground">{contact.notes}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {actions}
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon /> Modifier
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Supprimer le contact"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Supprimer ${contact.name} ? Les entrées liées sont conservées.`)) return;
            startTransition(async () => {
              const result = await deleteContact(contact.id);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast("Contact supprimé");
              router.push("/contacts");
            });
          }}
        >
          <Trash2Icon />
        </Button>
      </div>
      <ContactDialog open={editing} contact={contact} projects={projects} onClose={() => setEditing(false)} />
    </header>
  );
}
