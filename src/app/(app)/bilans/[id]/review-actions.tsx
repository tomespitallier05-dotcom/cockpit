"use client";

import { CopyIcon, Loader2Icon, RefreshCwIcon, Share2Icon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createShareLink, regenerateReview, revokeShareLink } from "@/server/actions/reviews";

type Link = { id: string; expiresAt: Date; revoked: boolean; lastViewedAt: Date | null };

export function ReviewActions({ reviewId, links }: { reviewId: string; links: Link[] }) {
  const [pending, startTransition] = useTransition();
  const [sharing, setSharing] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const regenerate = () =>
    startTransition(async () => {
      const result = await regenerateReview(reviewId);
      if (!result.ok) toast.error(result.error);
      else toast.success("Bilan mis à jour");
    });

  const share = () =>
    startTransition(async () => {
      const result = await createShareLink(reviewId, 30);
      if (!result.ok) return void toast.error(result.error);
      setUrl(`${window.location.origin}${result.data.path}`);
    });

  const revoke = (id: string) =>
    startTransition(async () => {
      const result = await revokeShareLink(id);
      if (!result.ok) toast.error(result.error);
      else toast.success("Lien révoqué");
    });

  const active = links.filter((link) => !link.revoked && new Date(link.expiresAt) > new Date());

  return (
    <>
      <Button variant="outline" onClick={regenerate} disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
        Mettre à jour
      </Button>
      <Button
        onClick={() => {
          setUrl(null);
          setSharing(true);
        }}
      >
        <Share2Icon /> Partager avec le mentor
      </Button>
      <Dialog open={sharing} onOpenChange={setSharing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Partager ce bilan</DialogTitle>
            <DialogDescription>
              Un lien en lecture seule vers ce bilan uniquement, valable 30 jours. Tu peux le révoquer à tout moment.
            </DialogDescription>
          </DialogHeader>
          {url ? (
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(event) => event.target.select()} aria-label="Lien de partage" />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copier"
                onClick={() => {
                  void navigator.clipboard.writeText(url);
                  toast.success("Lien copié");
                }}
              >
                <CopyIcon />
              </Button>
            </div>
          ) : (
            <Button onClick={share} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <Share2Icon />}
              Créer le lien
            </Button>
          )}
          {url ? <p className="text-[12px] text-subtle">Copie-le maintenant : il ne sera plus affiché ensuite.</p> : null}
          {active.length ? (
            <div className="border-t border-border pt-3">
              <p className="text-[12px] text-subtle">Liens actifs</p>
              <ul className="mt-2 space-y-1.5">
                {active.map((link) => (
                  <li key={link.id} className="flex items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
                    <span>
                      Expire le {new Date(link.expiresAt).toLocaleDateString("fr-FR")}
                      {link.lastViewedAt ? ` · vu le ${new Date(link.lastViewedAt).toLocaleDateString("fr-FR")}` : " · jamais ouvert"}
                    </span>
                    <Button variant="ghost" size="xs" onClick={() => revoke(link.id)} disabled={pending}>
                      <XIcon /> Révoquer
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
