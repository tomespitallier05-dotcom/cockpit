import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { ReviewBody } from "@/components/reviews/review-body";
import { Skeleton } from "@/components/ui/skeleton";
import { PERIOD_LABELS, periodTitle } from "@/lib/periods";
import { getSharedReview } from "@/server/data/reviews";

export const metadata: Metadata = { title: "Bilan partagé", robots: { index: false, follow: false } };

/** Public, read-only view of one review shared with the mentor. No session involved. */
export default function SharedReviewPage({ params }: PageProps<"/partage/[token]">) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 pb-16 sm:px-8">
      <Logo />
      <Suspense fallback={<Skeleton className="mt-10 h-96 w-full rounded-2xl" />}>
        <SharedReview params={params} />
      </Suspense>
    </div>
  );
}

async function SharedReview({ params }: { params: PageProps<"/partage/[token]">["params"] }) {
  const { token } = await params;
  const shared = await getSharedReview(token);
  if (!shared) notFound();
  return (
    <>
      <header className="mt-10">
        <p className="text-[12px] tracking-wide text-subtle uppercase">
          {PERIOD_LABELS[shared.period]} · partagé par {shared.ownerName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-foreground first-letter:uppercase">
          {periodTitle(shared.period, shared.periodStart)}
        </h1>
        <p className="mt-1 text-[12.5px] text-subtle">Lien en lecture seule, valable jusqu&apos;au {shared.expiresAt.toLocaleDateString("fr-FR")}.</p>
      </header>
      <div className="mt-8">
        <ReviewBody content={shared.content} snapshot={shared.snapshot} />
      </div>
    </>
  );
}
