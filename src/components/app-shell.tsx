import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListChecks,
  Flame,
  LogOut,
  Sparkles,
  Menu,
  X,
  Calendar as CalendarIcon,
  Tags,
  Ban,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calendar", label: "Calendar", icon: CalendarIcon },
  { to: "/routine", label: "Daily Routine", icon: ListChecks },
  { to: "/habits", label: "Habits", icon: Flame },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/negative-habits", label: "Avoid List", icon: Ban },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/auth", replace: true });
  };

  const SidebarContent = (
    <div className="flex h-full flex-col gap-2 p-4">
      <Link to="/dashboard" className="mb-4 flex items-center gap-3 px-2">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--gradient-primary)] shadow-[var(--shadow-glow)]">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">LifeOS</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">v1.0</p>
        </div>
      </Link>
      <nav className="flex flex-col gap-1">
        {nav.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", active && "text-primary")} />
              <span>{item.label}</span>
              {active && (
                <motion.div
                  layoutId="active-dot"
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        {SidebarContent}
      </aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 22 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-sidebar-border bg-sidebar lg:hidden"
            >
              {SidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 min-w-0">
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/60 px-4 py-3 backdrop-blur-xl lg:hidden">
          <button onClick={() => setOpen((v) => !v)} className="rounded-md p-2 hover:bg-accent/20">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-semibold">LifeOS</span>
          <div className="w-9" />
        </div>
        <div className="mx-auto w-full max-w-7xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
