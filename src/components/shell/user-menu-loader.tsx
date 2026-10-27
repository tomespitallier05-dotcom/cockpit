import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/server/session";
import { UserMenu } from "./user-menu";

export async function UserMenuLoader({ compact = false }: { compact?: boolean }) {
  const me = await getCurrentUser();
  return <UserMenu user={{ name: me.name, email: me.email, image: me.image }} compact={compact} />;
}

export function UserMenuSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) return <Skeleton className="size-8 rounded-full" />;
  return (
    <div className="flex h-10 items-center gap-2.5 px-2">
      <Skeleton className="size-6 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-2.5 w-24 rounded" />
        <Skeleton className="h-2 w-32 rounded" />
      </div>
    </div>
  );
}
