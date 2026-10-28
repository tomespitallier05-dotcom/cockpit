"use client";

import { BellOffIcon, BellRingIcon, CheckCheckIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, removePushSubscription, savePushSubscription } from "@/server/actions/notifications";

export function MarkRead() {
  const [pending, startTransition] = useTransition();
  return (
    <div className="-mb-3 flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(async () => void (await markAllNotificationsRead()))}
      >
        <CheckCheckIcon /> Tout marquer comme lu
      </Button>
    </div>
  );
}

const noop = () => () => {};

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/** Web Push on this device: registers the service worker and stores the subscription. */
export function PushToggle({ configured, publicKey, subscriptions }: { configured: boolean; publicKey: string | null; subscriptions: number }) {
  // Capability check without a render-time mismatch: null on the server, then the real answer.
  const supported = useSyncExternalStore(
    noop,
    () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    () => null,
  );
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setEndpoint(subscription?.endpoint ?? null))
      .catch(() => undefined);
  }, [supported]);

  const enable = () =>
    startTransition(async () => {
      try {
        if (!publicKey) throw new Error("Clés VAPID absentes.");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Notifications refusées dans le navigateur.");
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const result = await savePushSubscription({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent.slice(0, 300) });
        if (!result.ok) throw new Error(result.error);
        setEndpoint(json.endpoint);
        toast.success("Notifications activées sur cet appareil");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Activation impossible.");
      }
    });

  const disable = () =>
    startTransition(async () => {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEndpoint(null);
      toast.success("Notifications désactivées sur cet appareil");
    });

  return (
    <section className="surface flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="min-w-0">
        <h2 className="text-[13.5px] font-medium text-foreground">Sur cet appareil</h2>
        <p className="mt-0.5 text-[12.5px] text-subtle">
          {!configured
            ? "Les notifications push s'activent quand les clés VAPID sont ajoutées dans Vercel."
            : supported === false
              ? "Ce navigateur ne gère pas les notifications. Sur iPhone : ajoute Cockpit à l'écran d'accueil, puis ouvre-le depuis l'icône."
              : endpoint
                ? `Activées. ${subscriptions} appareil${subscriptions > 1 ? "s" : ""} au total.`
                : "Reçois ton brief chaque matin et les bilans quand ils sont prêts."}
        </p>
      </div>
      {configured && supported ? (
        endpoint ? (
          <Button variant="outline" size="sm" onClick={disable} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <BellOffIcon />}
            Désactiver
          </Button>
        ) : (
          <Button size="sm" onClick={enable} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <BellRingIcon />}
            Activer
          </Button>
        )
      ) : null}
    </section>
  );
}
