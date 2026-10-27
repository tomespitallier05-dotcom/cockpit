"use client";

import { CheckIcon, ChevronsUpDownIcon, InboxIcon, UsersIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { ProjectIcon } from "@/components/project-icon";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ProjectOption = { id: string; name: string; icon: string; color: string };
export type ContactOption = { id: string; name: string; role: string | null };

const triggerClass =
  "inline-flex h-8 max-w-full items-center gap-2 rounded-lg border border-border bg-white/[0.02] px-2.5 text-[13px] text-foreground outline-none transition-colors hover:border-white/15 focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:border-white/15";

export function ProjectPicker({
  projects,
  value,
  onChange,
  emptyLabel = "Inbox (à trier)",
  open: controlledOpen,
  onOpenChange,
  trigger,
}: {
  projects: ProjectOption[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  emptyLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const selected = projects.find((project) => project.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button type="button" className={triggerClass}>
            {selected ? (
              <ProjectIcon icon={selected.icon} color={selected.color} size="xs" />
            ) : (
              <InboxIcon className="size-3.5 text-subtle" />
            )}
            <span className="truncate">{selected?.name ?? emptyLabel}</span>
            <ChevronsUpDownIcon className="size-3 shrink-0 text-subtle" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Projet…" />
          <CommandList>
            <CommandEmpty>Aucun projet.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__ aucun inbox"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <InboxIcon className="text-subtle" />
                {emptyLabel}
                {value === null ? <CheckIcon className="ml-auto size-3.5" /> : null}
              </CommandItem>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`${project.name} ${project.id}`}
                  onSelect={() => {
                    onChange(project.id);
                    setOpen(false);
                  }}
                >
                  <ProjectIcon icon={project.icon} color={project.color} size="xs" />
                  <span className="truncate">{project.name}</span>
                  {value === project.id ? <CheckIcon className="ml-auto size-3.5" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function ContactPicker({
  contacts,
  value,
  onChange,
  placeholder = "Personnes",
}: {
  contacts: ContactOption[];
  value: string[];
  onChange: (contactIds: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = contacts.filter((contact) => value.includes(contact.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(triggerClass, "w-full justify-start")}>
          <UsersIcon className="size-3.5 shrink-0 text-subtle" />
          <span className={cn("truncate", selected.length === 0 && "text-subtle")}>
            {selected.length ? selected.map((contact) => contact.name).join(", ") : placeholder}
          </span>
          <ChevronsUpDownIcon className="ml-auto size-3 shrink-0 text-subtle" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Chercher un contact…" />
          <CommandList>
            <CommandEmpty>Aucun contact. Ajoute-en depuis la page Contacts.</CommandEmpty>
            <CommandGroup>
              {contacts.map((contact) => (
                <CommandItem key={contact.id} value={`${contact.name} ${contact.id}`} onSelect={() => toggle(contact.id)}>
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded border",
                      value.includes(contact.id) ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {value.includes(contact.id) ? <CheckIcon className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="truncate">{contact.name}</span>
                  {contact.role ? <span className="ml-auto truncate text-xs text-subtle">{contact.role}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
