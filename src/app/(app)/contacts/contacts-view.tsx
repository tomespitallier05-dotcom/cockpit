"use client";

import { SearchIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ContactDialog } from "@/components/contacts/contact-dialog";
import type { ProjectOption } from "@/components/pickers";
import { initials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { shortDayLabel } from "@/lib/dates";
import { CONTACT_RELATIONSHIPS, type ContactRelationship } from "@/lib/entry-catalog";

export type ContactCard = {
  id: string;
  name: string;
  role: string | null;
  relationship: ContactRelationship;
  company: string | null;
  lastEntryAt: Date | null;
  nextInteractionAt: Date | null;
};

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ContactsView({
  contacts,
  projects,
  timeZone,
  openNew,
}: {
  contacts: ContactCard[];
  projects: ProjectOption[];
  timeZone: string;
  openNew: boolean;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(openNew);
  // ?nouveau=1 (from ⌘K) opens the form, even when this page is already displayed.
  const [seenOpenNew, setSeenOpenNew] = useState(openNew);
  if (seenOpenNew !== openNew) {
    setSeenOpenNew(openNew);
    if (openNew) setCreating(true);
  }

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return contacts;
    return contacts.filter((item) => normalize(`${item.name} ${item.role ?? ""} ${item.company ?? ""}`).includes(q));
  }, [contacts, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="surface flex h-9 min-w-0 flex-1 items-center gap-2 px-3">
          <SearchIcon className="size-3.5 text-subtle" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrer par nom, rôle, entreprise…"
            aria-label="Filtrer les contacts"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-subtle"
          />
        </div>
        <Button onClick={() => setCreating(true)} aria-label="Nouveau contact">
          <UserPlusIcon />
          <span className="hidden sm:inline">Nouveau contact</span>
        </Button>
      </div>

      {contacts.length === 0 ? (
        <div className="surface px-6 py-14 text-center">
          <p className="text-[15px] font-medium text-foreground">Aucun contact</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-muted-foreground">
            Commence par ton mentor : chaque appel et chaque conseil pourra ensuite lui être relié.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <li key={item.id}>
              <Link
                href={`/contacts/${item.id}`}
                className="surface flex h-full items-start gap-3 p-4 outline-none transition-[transform,border-color] duration-200 ease-out-expo hover:-translate-y-0.5 hover:border-white/12 focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#2a2f3d,#1b1e27)] text-[13px] font-semibold text-foreground/85">
                  {initials(item.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-foreground">{item.name}</span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {[item.role, item.company].filter(Boolean).join(" · ") || CONTACT_RELATIONSHIPS[item.relationship]}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-subtle">
                    <span className="rounded-full border border-border px-2 py-0.5">{CONTACT_RELATIONSHIPS[item.relationship]}</span>
                    {item.lastEntryAt ? <span>Dernier échange : {shortDayLabel(item.lastEntryAt, timeZone)}</span> : null}
                    {item.nextInteractionAt ? (
                      <span className="text-primary">Prochain : {shortDayLabel(item.nextInteractionAt, timeZone)}</span>
                    ) : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <ContactDialog open={creating} contact={null} projects={projects} onClose={() => setCreating(false)} />
    </div>
  );
}
