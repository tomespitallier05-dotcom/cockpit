"use client";

import { defaultFilter } from "cmdk";
import { CheckCircle2Icon, CircleIcon, FolderPlusIcon, ListTodoIcon, LogOutIcon, Loader2Icon, UserPlusIcon, UserIcon, ZapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { EntryGlyph } from "@/components/entry-type-icon";
import { ProjectIcon } from "@/components/project-icon";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { entryTypeMeta } from "@/lib/entry-catalog";
import { searchEverything, type SearchResults } from "@/server/actions/search";
import { ALL_NAV } from "./nav-config";
import { useShell } from "./shell-provider";
import { useSignOut } from "./user-menu";

export type PaletteProject = { id: string; name: string; slug: string; icon: string; color: string };

const stripAccents = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** cmdk's fuzzy scoring, made accent-insensitive: "regl" finds "Réglages". */
function frenchFilter(value: string, search: string, keywords?: string[]) {
  return defaultFilter(stripAccents(value), stripAccents(search), keywords?.map(stripAccents));
}

const KEYWORDS: Record<string, string[]> = {
  "/": ["accueil", "dashboard", "home", "today"],
  "/taches": ["todo", "tasks"],
  "/objectifs": ["goals", "kpi", "okr", "metriques"],
  "/contacts": ["crm", "mentor", "personnes"],
  "/assistant": ["ia", "ai", "claude", "chat"],
  "/analytics": ["stats", "statistiques", "graphiques"],
  "/bilans": ["review", "revue", "hebdo", "mensuel"],
  "/reglages": ["settings", "parametres", "securite", "passkey"],
};

const NO_RESULTS: SearchResults = { entries: [], tasks: [], contacts: [], projects: [] };

export function CommandPalette({ projects }: { projects: PaletteProject[] }) {
  const { paletteOpen, setPaletteOpen } = useShell();
  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      title="Palette de commandes"
      description="Rechercher dans Cockpit, aller à une page ou lancer une action"
      className="border border-border bg-popover shadow-[var(--shadow-pop)] sm:max-w-xl"
    >
      {/* Mounted only while open: every opening starts with an empty query. */}
      <PaletteBody projects={projects} />
    </CommandDialog>
  );
}

function PaletteBody({ projects }: { projects: PaletteProject[] }) {
  const router = useRouter();
  const { setPaletteOpen, capture, openProjectDialog } = useShell();
  const { signOut } = useSignOut();
  const [query, setQuery] = useState("");
  const [fetched, setFetched] = useState<SearchResults>(NO_RESULTS);
  const [searching, startSearch] = useTransition();
  const trimmed = query.trim();
  const results = trimmed.length >= 2 ? fetched : NO_RESULTS;

  // Debounced server search; static items keep filtering instantly client-side.
  useEffect(() => {
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => {
      startSearch(async () => {
        try {
          setFetched(await searchEverything(trimmed));
        } catch {
          setFetched(NO_RESULTS);
        }
      });
    }, 160);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const go = (href: string) => {
    setPaletteOpen(false);
    router.push(href);
  };

  // Server matches are stemmed, so they may not contain the typed text: the
  // query itself is passed as a keyword so cmdk never filters them out.
  const matchAlways = [query];
  const hasResults =
    results.entries.length + results.tasks.length + results.contacts.length > 0;

  return (
      <Command filter={frenchFilter}>
        <CommandInput placeholder="Rechercher partout, ou aller à…" value={query} onValueChange={setQuery} />
        <CommandList className="max-h-[min(460px,62vh)]">
          <CommandEmpty>
            {searching ? (
              <span className="inline-flex items-center gap-2 text-subtle">
                <Loader2Icon className="size-3.5 animate-spin" /> Recherche…
              </span>
            ) : (
              "Aucun résultat."
            )}
          </CommandEmpty>

          {hasResults ? (
            <>
              {results.entries.length ? (
                <CommandGroup heading="Entrées">
                  {results.entries.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`entree ${item.id} ${item.title ?? ""}`}
                        keywords={matchAlways}
                        onSelect={() => go(`/entrees/${item.id}`)}
                        className="items-start"
                      >
                        <EntryGlyph type={item.type} className="mt-0.5" style={{ color: entryTypeMeta(item.type).color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{item.title || item.snippet || "Sans titre"}</span>
                          {item.title && item.snippet ? (
                            <span className="block truncate text-xs text-subtle">{item.snippet}</span>
                          ) : null}
                        </span>
                        {item.projectName ? <span className="shrink-0 text-xs text-subtle">{item.projectName}</span> : null}
                      </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {results.tasks.length ? (
                <CommandGroup heading="Tâches">
                  {results.tasks.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`tache ${item.id} ${item.title}`}
                      keywords={matchAlways}
                      onSelect={() => go(`/taches?tache=${item.id}`)}
                    >
                      {item.status === "done" ? <CheckCircle2Icon className="text-success" /> : <CircleIcon />}
                      <span className="truncate">{item.title}</span>
                      {item.projectName ? <span className="ml-auto text-xs text-subtle">{item.projectName}</span> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {results.contacts.length ? (
                <CommandGroup heading="Contacts">
                  {results.contacts.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`contact ${item.id} ${item.name}`}
                      keywords={matchAlways}
                      onSelect={() => go(`/contacts/${item.id}`)}
                    >
                      <UserIcon />
                      <span className="truncate">{item.name}</span>
                      {item.role ? <span className="ml-auto text-xs text-subtle">{item.role}</span> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              <CommandSeparator />
            </>
          ) : null}

          <CommandGroup heading="Actions">
            <CommandItem value="capturer note rapide appel message" onSelect={() => capture()}>
              <ZapIcon className="text-primary" />
              Capturer
              <CommandShortcut>C</CommandShortcut>
            </CommandItem>
            <CommandItem value="nouvelle tache" onSelect={() => go("/taches?nouvelle=1")}>
              <ListTodoIcon />
              Nouvelle tâche
            </CommandItem>
            <CommandItem value="nouveau contact" onSelect={() => go("/contacts?nouveau=1")}>
              <UserPlusIcon />
              Nouveau contact
            </CommandItem>
            <CommandItem value="nouveau projet" onSelect={() => openProjectDialog()}>
              <FolderPlusIcon />
              Nouveau projet
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Navigation">
            {ALL_NAV.map((item) => (
              <CommandItem
                key={item.href}
                value={item.label}
                keywords={KEYWORDS[item.href]}
                onSelect={() => go(item.href)}
              >
                <item.icon />
                {item.label}
                {item.shortcut ? <CommandShortcut>G {item.shortcut.toUpperCase()}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>

          {projects.length > 0 ? (
            <CommandGroup heading="Projets">
              {projects.map((project) => (
                <CommandItem
                  key={project.slug}
                  value={`projet ${project.name}`}
                  onSelect={() => go(`/projets/${project.slug}`)}
                >
                  <ProjectIcon icon={project.icon} color={project.color} size="xs" />
                  {project.name}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          <CommandSeparator />
          <CommandGroup heading="Compte">
            <CommandItem
              value="se deconnecter logout"
              onSelect={() => {
                setPaletteOpen(false);
                signOut();
              }}
            >
              <LogOutIcon />
              Se déconnecter
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
  );
}
