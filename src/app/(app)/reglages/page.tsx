import { BellIcon, BotIcon, DatabaseIcon, Settings2Icon } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { PhaseBadge } from "@/components/phase-badge";
import { Reveal } from "@/components/reveal";
import { UserAvatar } from "@/components/shell/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getSecurityStatus } from "@/server/queries";
import { getCurrentUser } from "@/server/session";
import { SecuritySettings } from "./security-settings";

export const metadata: Metadata = { title: "Réglages" };

export default function SettingsPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Réglages" description="Ton compte, ta sécurité et tes données." icon={<PageIcon icon={Settings2Icon} />} />

      <Section title="Profil" index={1}>
        <Suspense fallback={<Skeleton className="h-[72px] w-full rounded-2xl" />}>
          <Profile />
        </Suspense>
      </Section>

      <Section id="securite" title="Sécurité" index={2}>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
          <Security />
        </Suspense>
      </Section>

      <Section title="À venir" index={3}>
        <div className="surface divide-y divide-border">
          <Upcoming icon={<BotIcon />} title="Intelligence artificielle" phase={2}>
            Fournisseur et modèles (Claude par défaut), plafond de dépense mensuel, contexte personnel.
          </Upcoming>
          <Upcoming icon={<BellIcon />} title="Notifications" phase={3}>
            Brief du matin, revue hebdomadaire et rappels d&apos;échéances, sans surcharge.
          </Upcoming>
          <Upcoming icon={<DatabaseIcon />} title="Données et export" phase={4}>
            Export complet en Markdown et JSON, sauvegardes quotidiennes.
          </Upcoming>
        </div>
      </Section>
    </PageContainer>
  );
}

function Section({ id, title, index, children }: { id?: string; title: string; index: number; children: ReactNode }) {
  return (
    <Reveal index={index} className="mt-10 scroll-mt-20">
      <section id={id}>
        <h2 className="mb-3 text-[12px] font-medium tracking-[0.06em] text-subtle uppercase">{title}</h2>
        {children}
      </section>
    </Reveal>
  );
}

async function Profile() {
  const me = await getCurrentUser();
  return (
    <div className="surface flex items-center gap-4 p-5">
      <UserAvatar user={{ name: me.name, email: me.email, image: me.image }} className="size-11 text-sm" />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium text-foreground">{me.name}</p>
        <p className="truncate text-[13px] text-muted-foreground">{me.email}</p>
      </div>
    </div>
  );
}

async function Security() {
  const status = await getSecurityStatus();
  return <SecuritySettings twoFactorEnabled={status.twoFactorEnabled} />;
}

function Upcoming({ icon, title, phase, children }: { icon: ReactNode; title: string; phase: 1 | 2 | 3 | 4; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-5 [&>svg]:mt-0.5">
      <span className="mt-0.5 text-subtle [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-foreground">
          {title} <PhaseBadge phase={phase} />
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
