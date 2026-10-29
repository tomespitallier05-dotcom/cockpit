import {
  AudioLinesIcon,
  BellIcon,
  BotIcon,
  CalendarIcon,
  DatabaseIcon,
  DownloadIcon,
  MailIcon,
  MessageSquareIcon,
  Settings2Icon,
  Share2Icon,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { PageContainer, PageHeader, PageIcon } from "@/components/page-header";
import { ProgressMeter } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import { UserAvatar } from "@/components/shell/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { aiStatus } from "@/server/ai/config";
import { monthSpend } from "@/server/ai/usage";
import { googleAccount, googleConfigured } from "@/server/google";
import { requireUser } from "@/server/dal";
import { getSecurityStatus } from "@/server/queries";
import { getCurrentUser } from "@/server/session";
import { CopyValue, DiscordButton, GoogleButtons } from "./integrations";
import { SecuritySettings } from "./security-settings";

export const metadata: Metadata = { title: "Réglages" };

export default function SettingsPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Réglages" description="Ton compte, ta sécurité, l'IA, les intégrations et tes données." icon={<PageIcon icon={Settings2Icon} />} />

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

      <Section id="ia" title="Intelligence artificielle" index={3}>
        <Suspense fallback={<Skeleton className="h-28 w-full rounded-2xl" />}>
          <AiSettings />
        </Suspense>
      </Section>

      <Section id="integrations" title="Intégrations" index={4}>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
          <Integrations />
        </Suspense>
      </Section>

      <Section id="donnees" title="Notifications et données" index={5}>
        <div className="surface divide-y divide-border">
          <Row icon={<BellIcon />} title="Notifications" status={null}>
            Brief du matin, rappels et bilans prêts.{" "}
            <Link href="/notifications" className="text-foreground underline-offset-4 hover:underline">
              Gérer les notifications
            </Link>
          </Row>
          <Row icon={<DatabaseIcon />} title="Export complet" status={null}>
            Toutes tes données, à tout moment : JSON pour les machines, Markdown pour toi.
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/api/export?format=json">
                  <DownloadIcon /> JSON
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="/api/export?format=markdown">
                  <DownloadIcon /> Markdown (zip)
                </a>
              </Button>
            </div>
          </Row>
        </div>
      </Section>
    </PageContainer>
  );
}

async function AiSettings() {
  const me = await requireUser();
  const status = aiStatus();
  const spend = await monthSpend(me.workspaceId);
  const share = Math.min(1, spend.usd / status.budgetUsd);
  return (
    <div className="surface divide-y divide-border">
      <Row
        icon={<BotIcon />}
        title="Claude"
        status={status.mock ? "Simulé" : status.claude ? "Actif" : "À configurer"}
        ok={status.claude}
      >
        {status.claude
          ? `Modèle ${status.model}, avec repli automatique si une demande est refusée. Analyse des entrées, assistant, bilans, brief.`
          : "Ajoute ANTHROPIC_API_KEY dans les variables Vercel (Production et Preview) pour activer l'analyse, l'assistant et les bilans."}
        <div className="mt-3">
          <div className="flex justify-between text-[12px] text-subtle">
            <span>Dépense du mois</span>
            <span className="tabular-nums">
              {spend.usd.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $ / {status.budgetUsd} $ · {spend.calls} appel{spend.calls > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-1.5">
            <ProgressMeter value={share} label="Budget IA du mois" />
          </div>
        </div>
      </Row>
      <Row icon={<AudioLinesIcon />} title="Transcription et recherche par le sens" status={status.gateway ? "Actif" : "À configurer"} ok={status.gateway}>
        {status.gateway
          ? "Via Vercel AI Gateway : transcription des appels et notes vocales, vecteurs pour la recherche sémantique."
          : "Actif automatiquement sur Vercel (AI Gateway). En local : AI_GATEWAY_API_KEY, ou AI_MOCK=1 pour tester."}
      </Row>
    </div>
  );
}

/** https://inbound:SECRET@host/api/inbound/email: Postmark sends the secret as Basic auth. */
function inboundWebhookUrl(base: string) {
  try {
    const url = new URL("/api/inbound/email", base);
    return `${url.protocol}//inbound:SECRET@${url.host}${url.pathname}`;
  } catch {
    return "https://inbound:SECRET@ton-domaine/api/inbound/email";
  }
}

async function Integrations() {
  const me = await requireUser();
  const google = await googleAccount(me.id).catch(() => null);
  const base = process.env.BETTER_AUTH_URL ?? "";
  const discordReady = Boolean(process.env.DISCORD_PUBLIC_KEY && process.env.DISCORD_OWNER_ID);
  const discordCommands = Boolean(process.env.DISCORD_APPLICATION_ID && process.env.DISCORD_BOT_TOKEN);
  const emailReady = Boolean(process.env.INBOUND_EMAIL_SECRET);
  return (
    <div className="surface divide-y divide-border">
      <Row
        icon={<CalendarIcon />}
        title="Google Agenda et Drive"
        status={!googleConfigured() ? "À configurer" : google ? "Connecté" : "Non connecté"}
        ok={Boolean(google)}
        action={<GoogleButtons configured={googleConfigured()} linked={Boolean(google)} />}
      >
        {!googleConfigured()
          ? "Crée un client OAuth Google (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) avec l'URL de redirection ci-dessous."
          : google
            ? `Agenda ${google.calendar ? "✓" : "✗"} · Drive ${google.drive ? "✓" : "✗"}. Les appels à venir apparaissent sur Aujourd'hui ; l'Inbox importe depuis Drive.`
            : "Lecture seule : tes appels à venir et l'import des enregistrements Meet depuis Drive. Google ne sert jamais à se connecter."}
        {!googleConfigured() ? <CopyValue value={`${base}/api/auth/callback/google`} label="l'URL de redirection" /> : null}
      </Row>
      <Row
        icon={<MessageSquareIcon />}
        title="Bot Discord"
        status={discordReady ? "Actif" : "À configurer"}
        ok={discordReady}
        action={<DiscordButton configured={discordCommands} />}
      >
        {discordReady
          ? "/save pour une note, et clic droit sur un message → Applications → « Enregistrer dans Cockpit », même en message privé."
          : "Crée une application Discord, colle cette URL comme « Interactions Endpoint URL », puis ajoute DISCORD_PUBLIC_KEY, DISCORD_APPLICATION_ID, DISCORD_BOT_TOKEN et DISCORD_OWNER_ID (ton identifiant)."}
        <CopyValue value={`${base}/api/discord/interactions`} label="l'URL des interactions" />
      </Row>
      <Row icon={<MailIcon />} title="Email entrant" status={emailReady ? "Actif" : "À configurer"} ok={emailReady}>
        {emailReady
          ? "Transfère n'importe quel email à ton adresse de réception : il arrive dans l'Inbox, pièces jointes comprises."
          : "Avec Postmark (réception d'emails) : définis INBOUND_EMAIL_SECRET, puis colle cette URL de webhook en remplaçant SECRET par sa valeur. Le secret voyage dans l'en-tête d'authentification, jamais dans le chemin."}
        <CopyValue value={inboundWebhookUrl(base)} label="l'URL du webhook" />
      </Row>
      <Row icon={<Share2Icon />} title="Partage depuis le téléphone" status="Actif" ok>
        Sur Android : installe Cockpit (menu → Installer l&apos;application), puis Partager → Cockpit depuis n&apos;importe quelle app.
        Sur iPhone : un Raccourci « Obtenir le contenu de l&apos;URL » en POST vers l&apos;adresse ci-dessous, avec les champs text et url.
        <CopyValue value={`${base}/partager`} label="l'adresse de partage" />
      </Row>
    </div>
  );
}

function Row({
  icon,
  title,
  status,
  ok,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  status: string | null;
  ok?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 p-5">
      <span className="mt-0.5 text-subtle [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-foreground">
            {title}
            {status ? (
              <span className={ok ? "rounded-md bg-success/12 px-1.5 py-0.5 text-[11px] font-normal text-success" : "rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] font-normal text-subtle"}>
                {status}
              </span>
            ) : null}
          </p>
          {action}
        </div>
        <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
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
