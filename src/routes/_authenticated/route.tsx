import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ensureSupabaseSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("lifeos:auth") !== "1") {
      throw redirect({ to: "/auth" });
    }
    await ensureSupabaseSession();
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
