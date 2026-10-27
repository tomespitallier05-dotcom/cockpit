"use client";

import { ChevronsUpDownIcon, LogOutIcon, Settings2Icon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/format";

export type UserMenuUser = {
  name: string;
  email: string;
  image: string | null;
};

export function UserAvatar({ user, className }: { user: UserMenuUser; className?: string }) {
  return (
    <Avatar className={cn("size-6", className)}>
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      <AvatarFallback className="bg-[linear-gradient(145deg,#2a2f3d,#1b1e27)] text-[10px] font-semibold text-foreground/85">
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function useSignOut() {
  const [pending, startTransition] = useTransition();
  const signOut = () =>
    startTransition(async () => {
      const { error } = await authClient.signOut();
      if (error) {
        toast.error("Impossible de te déconnecter. Réessaie.");
        return;
      }
      // A full page load, not a client navigation: the router keeps visited pages
      // in memory for instant back/forward, and none of them should survive sign-out.
      window.location.replace("/login");
    });
  return { signOut, pending };
}

export function UserMenu({ user, compact = false }: { user: UserMenuUser; compact?: boolean }) {
  const { signOut, pending } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label="Menu du compte"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <UserAvatar user={user} className="size-8" />
          </button>
        ) : (
          <button
            type="button"
            className="flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left outline-none transition-colors hover:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-white/[0.05]"
          >
            <UserAvatar user={user} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">{user.name}</span>
              <span className="block truncate text-[11.5px] text-subtle">{user.email}</span>
            </span>
            <ChevronsUpDownIcon className="size-3.5 text-subtle" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-[13px] font-medium text-foreground">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/reglages">
            <Settings2Icon />
            Réglages
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/reglages#securite">
            <ShieldCheckIcon />
            Sécurité
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} disabled={pending}>
          <LogOutIcon />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
