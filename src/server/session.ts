import "server-only";
import { cacheLife } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { findWorkspaceByOwner } from "./workspace";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  twoFactorEnabled: boolean;
  workspaceId: string;
  timezone: string;
};

/**
 * Data Access Layer entry point: every server read of user data goes through here.
 * The proxy only checks that a session cookie exists; this validates it.
 * `use cache: private` keeps the result per browser and lets navigations prefetch it.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  "use cache: private";
  cacheLife("minutes");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  const ws = await findWorkspaceByOwner(session.user.id);
  if (!ws) {
    redirect("/login");
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
    twoFactorEnabled: Boolean(session.user.twoFactorEnabled),
    workspaceId: ws.id,
    timezone: ws.timezone,
  };
}
