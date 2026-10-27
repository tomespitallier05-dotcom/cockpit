import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { Reveal } from "@/components/reveal";

/** A module page that is designed but not built yet: header + roadmap empty state. */
export function ModulePlaceholder({
  icon,
  title,
  description,
  empty,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  empty: Omit<ComponentProps<typeof EmptyState>, "icon">;
}) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} icon={<PageIcon icon={icon} />} />
      <Reveal index={1} className="mt-8">
        <EmptyState icon={icon} {...empty} />
      </Reveal>
    </PageContainer>
  );
}
