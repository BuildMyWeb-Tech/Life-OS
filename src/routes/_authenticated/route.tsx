import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { clearLocalAuth, ensureSupabaseSession } from "@/lib/auth";
import { getCurrentUserId, loadPagePrefs } from "@/features/page-visibility";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("lifeos:auth") !== "1") {
      throw redirect({ to: "/auth" });
    }
    const hasSession = await ensureSupabaseSession();
    if (!hasSession) {
      console.warn("[auth] No verified session after retries — redirecting to /auth.");
      clearLocalAuth();
      throw redirect({ to: "/auth" });
    }
    // Redirect new users to onboarding if they haven't set page prefs yet
    const userId = await getCurrentUserId();
    if (userId && loadPagePrefs(userId) === null) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});