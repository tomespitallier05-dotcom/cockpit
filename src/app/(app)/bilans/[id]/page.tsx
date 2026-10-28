import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/page-header";
import { ReviewBody } from "@/components/reviews/review-body";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PERIOD_LABELS, periodTitle } from "@/lib/periods";
import { getReview } from "@/server/data/reviews";
import { ReviewActions } from "./review-actions";

export const metadata: Metadata = { title: "Bilan" };

export default function ReviewPage({ params }: PageProps<"/bilans/[id]">) {
  return (
    <PageContainer className="max-w-4xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
        <Link href="/bilans">
          <ArrowLeftIcon /> Bilans
        </Link>
      </Button>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <ReviewLoader params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function ReviewLoader({ params }: { params: PageProps<"/bilans/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const item = await getReview(id);
  if (!item) notFound();
  return (
    <>
      <PageHeader
        title={<span className="first-letter:uppercase">{periodTitle(item.period, item.periodStart)}</span>}
        description={`${PERIOD_LABELS[item.period]} · ${item.generatedBy === "ai" ? "rédigé par l'IA à partir de tes chiffres" : "rédigé à partir de tes chiffres"}`}
        actions={
          <ReviewActions
            reviewId={item.id}
            links={item.links.map((link) => ({
              id: link.id,
              expiresAt: link.expiresAt,
              revoked: Boolean(link.revokedAt),
              lastViewedAt: link.lastViewedAt,
            }))}
          />
        }
      />
      <div className="mt-8">
        <ReviewBody content={item.content} snapshot={item.snapshot} />
      </div>
    </>
  );
}
