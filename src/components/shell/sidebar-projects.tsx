import { ProjectIcon } from "@/components/project-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { listProjects } from "@/server/queries";
import { NavLink } from "./nav-link";

export async function SidebarProjects() {
  const projects = await listProjects();

  if (projects.length === 0) {
    return <p className="px-2.5 py-1.5 text-[12.5px] text-subtle">Aucun projet actif.</p>;
  }

  return projects.map((project) => (
    <NavLink
      key={project.id}
      href={`/projets/${project.slug}`}
      icon={<ProjectIcon icon={project.icon} color={project.color} size="xs" />}
    >
      {project.name}
    </NavLink>
  ));
}

export function SidebarProjectsSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 px-2.5 py-1">
      {[72, 56, 64].map((width) => (
        <div key={width} className="flex h-6 items-center gap-2.5">
          <Skeleton className="size-4 rounded-[5px]" />
          <Skeleton className="h-3 rounded" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
}
