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
  BarChart3,
  Briefcase,
  CheckSquare,
  Wand2,
  Target,
  Phone,
  HelpCircle,
} from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { logout, attachSessionKeepAlive } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Reminders } from "@/features/reminders";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/routine", label: "Daily Routine", icon: ListChecks },
  {
    to: "/work",
    label: "Work & Projects",
    icon: Briefcase,
    children: [
      { to: "/client-calls", label: "Client Calls", icon: Phone },
      { to: "/client-leads", label: "Client Leads", icon: Target },
    ],
  },
  { to: "/tasks", label: "To Do List", icon: CheckSquare },
  { to: "/asks", label: "Asks", icon: HelpCircle },
  { to: "/habits", label: "Habits", icon: Flame },
  { to: "/vision-board", label: "Vision Board", icon: Wand2 },
  { to: "/report", label: "Report", icon: BarChart3 },
  { to: "/calendar", label: "Calendar", icon: CalendarIcon },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/negative-habits", label: "Avoid List", icon: Ban },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => attachSessionKeepAlive(), []);

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
          const children = "children" in item ? item.children : undefined;
          return (
            <div key={item.to}>
              <Link
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
              {children && (
                <div className="ml-5 mt-1 flex flex-col gap-1 border-l border-sidebar-border pl-3">
                  {children.map((child) => {
                    const childActive = pathname === child.to;
                    const ChildIcon = child.icon;
                    return (
                      <Link
                        key={child.to}
                        to={child.to}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-all",
                          childActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                        )}
                      >
                        <ChildIcon className={cn("h-3.5 w-3.5", childActive && "text-primary")} />
                        <span>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
        <div className="mx-auto w-full max-w-7xl p-4 pb-24 md:p-8 lg:pb-8">{children}</div>
        <BottomNav pathname={pathname} />
      </main>
      <Reminders />
    </div>
  );
}

const bottomNav = [
  { to: "/routine", label: "Routine", icon: ListChecks },
  { to: "/work", label: "Work", icon: Briefcase },
  { to: "/tasks", label: "To Do", icon: CheckSquare },
  { to: "/client-leads", label: "Leads", icon: Target },
  { to: "/client-calls", label: "Calls", icon: Phone },
  { to: "/vision-board", label: "Vision", icon: Wand2 },
  { to: "/report", label: "Report", icon: BarChart3 },
] as const;

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl lg:hidden">
      <ul className="mx-auto flex max-w-2xl overflow-x-auto">
        {bottomNav.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1 min-w-[64px]">
              <Link
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}