"use client";

import { defaultFilter } from "cmdk";
import { LogOutIcon, ZapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { ALL_NAV } from "./nav-config";
import { useShell } from "./shell-provider";
import { useSignOut } from "./user-menu";

export type PaletteProject = { name: string; slug: string; icon: string; color: string };

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

export function CommandPalette({ projects }: { projects: PaletteProject[] }) {
  const router = useRouter();
  const { paletteOpen, setPaletteOpen, capture } = useShell();
  const { signOut } = useSignOut();

  const go = (href: string) => {
    setPaletteOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      title="Palette de commandes"
      description="Aller à une page, un projet, ou lancer une action"
      className="border border-border bg-popover shadow-[var(--shadow-pop)] sm:max-w-xl"
    >
      <Command filter={frenchFilter}>
        <CommandInput placeholder="Aller à… ou lancer une action" />
        <CommandList className="max-h-[min(420px,60vh)]">
          <CommandEmpty>
            Rien trouvé.
            <span className="mt-1 block text-xs text-subtle">
              La recherche dans tes notes, appels et messages arrive en phase 1.
            </span>
          </CommandEmpty>

          <CommandGroup heading="Actions">
            <CommandItem value="capturer note rapide" onSelect={capture}>
              <ZapIcon className="text-primary" />
              Capturer une note
              <CommandShortcut>C</CommandShortcut>
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
                {item.shortcut ? (
                  <CommandShortcut>G {item.shortcut.toUpperCase()}</CommandShortcut>
                ) : null}
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
    </CommandDialog>
  );
}
