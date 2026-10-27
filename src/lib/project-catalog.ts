// Shared, framework-free definitions for projects. Imported by both the server
// (seeding, validation) and the client (pickers, badges), so no React here.

export const PROJECT_COLORS = {
  blue: "#5b8cff",
  violet: "#9b7bff",
  teal: "#3cc6b4",
  green: "#5bbf6a",
  amber: "#e0a33b",
  orange: "#e8794a",
  rose: "#e5679a",
  slate: "#8b93a7",
} as const;

export type ProjectColor = keyof typeof PROJECT_COLORS;

export const PROJECT_ICON_NAMES = [
  "shopping-bag",
  "clapperboard",
  "briefcase",
  "rocket",
  "target",
  "sparkles",
  "heart-pulse",
  "book-open",
  "folder",
] as const;

export type ProjectIconName = (typeof PROJECT_ICON_NAMES)[number];

export const PROJECT_STATUSES = ["active", "paused", "done", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Actif",
  paused: "En pause",
  done: "Terminé",
  archived: "Archivé",
};

/**
 * Templates give each project its own internal organisation without building a
 * generic database editor. `module` is the template-specific tab.
 */
export const PROJECT_TEMPLATES = {
  resale: {
    label: "Achat-revente",
    description: "Inventaire, marges, rotation du stock et KPI de vente.",
    icon: "shopping-bag",
    color: "teal",
    module: { key: "inventory", label: "Inventaire" },
  },
  content: {
    label: "Création de contenu",
    description: "Pipeline idée → publication, banque de hooks et statistiques.",
    icon: "clapperboard",
    color: "rose",
    module: { key: "pipeline", label: "Pipeline" },
  },
  business: {
    label: "Business",
    description: "Objectifs, décisions et stratégie.",
    icon: "briefcase",
    color: "blue",
    module: { key: "decisions", label: "Décisions" },
  },
  blank: {
    label: "Projet vide",
    description: "Une base générique à organiser librement.",
    icon: "folder",
    color: "slate",
    module: null,
  },
} as const satisfies Record<
  string,
  {
    label: string;
    description: string;
    icon: ProjectIconName;
    color: ProjectColor;
    module: { key: string; label: string } | null;
  }
>;

export type ProjectTemplate = keyof typeof PROJECT_TEMPLATES;

/** Projects created for a brand-new workspace, so the app never starts empty. */
export const STARTER_PROJECTS: {
  name: string;
  slug: string;
  description: string;
  template: ProjectTemplate;
}[] = [
  {
    name: "Achat-revente",
    slug: "achat-revente",
    description: "Sourcing, ventes et marges.",
    template: "resale",
  },
  {
    name: "Instagram",
    slug: "instagram",
    description: "Idées, tournages, publications et statistiques.",
    template: "content",
  },
  {
    name: "Business",
    slug: "business",
    description: "Stratégie, décisions et objectifs.",
    template: "business",
  },
];

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
