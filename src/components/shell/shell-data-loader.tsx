import { CaptureDialog } from "@/components/capture/capture-dialog";
import { requireUser } from "@/server/dal";
import { listProjects } from "@/server/queries";
import { uploadConfigFor } from "@/server/upload-config";
import { CommandPalette } from "./command-palette";

/** Session-bound pieces of the shell: palette and quick capture need the project list. */
export async function ShellDataLoader() {
  const [me, projects] = await Promise.all([requireUser(), listProjects()]);
  const options = projects.map(({ id, name, slug, icon, color }) => ({ id, name, slug, icon, color }));
  return (
    <>
      <CommandPalette projects={options} />
      <CaptureDialog projects={options} uploadConfig={uploadConfigFor(me)} />
    </>
  );
}

export function ShellDataFallback() {
  return (
    <>
      <CommandPalette projects={[]} />
      <CaptureDialog projects={[]} uploadConfig={null} />
    </>
  );
}
