import { Suspense } from "react";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { Hotkeys } from "@/components/shell/hotkeys";
import { InboxBadge } from "@/components/shell/inbox-badge";
import { MobileNav, MobileTopBar } from "@/components/shell/mobile-nav";
import { ShellDataFallback, ShellDataLoader } from "@/components/shell/shell-data-loader";
import { ShellProvider } from "@/components/shell/shell-provider";
import { Sidebar } from "@/components/shell/sidebar";
import { SidebarProjects, SidebarProjectsSkeleton } from "@/components/shell/sidebar-projects";
import { UserMenuLoader, UserMenuSkeleton } from "@/components/shell/user-menu-loader";

// The chrome is static and prerenders instantly; everything that reads the
// session streams in behind its own Suspense boundary.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ShellProvider>
      <Sidebar
        projects={
          <Suspense fallback={<SidebarProjectsSkeleton />}>
            <SidebarProjects />
          </Suspense>
        }
        inboxBadge={
          <Suspense fallback={null}>
            <InboxBadge />
          </Suspense>
        }
        userMenu={
          <Suspense fallback={<UserMenuSkeleton />}>
            <UserMenuLoader />
          </Suspense>
        }
      />
      <MobileTopBar
        userMenu={
          <Suspense fallback={<UserMenuSkeleton compact />}>
            <UserMenuLoader compact />
          </Suspense>
        }
      />
      <main className="relative min-h-dvh md:pl-60">{children}</main>
      <MobileNav />
      <Suspense fallback={<ShellDataFallback />}>
        <ShellDataLoader />
      </Suspense>
      <ProjectDialog />
      <Hotkeys />
    </ShellProvider>
  );
}
