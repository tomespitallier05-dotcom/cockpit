import { listProjects } from "@/server/queries";
import { CommandPalette } from "./command-palette";

export async function CommandPaletteLoader() {
  const projects = await listProjects();
  return (
    <CommandPalette
      projects={projects.map(({ name, slug, icon, color }) => ({ name, slug, icon, color }))}
    />
  );
}
