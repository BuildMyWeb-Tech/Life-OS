import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
  className,
  compact,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  accent?: "primary" | "accent" | "success" | "warning";
  className?: string;
  compact?: boolean;
}) {
  const accentClass = {
    primary: "text-primary",
    accent: "text-accent",
    success: "text-[color:var(--success)]",
    warning: "text-[color:var(--warning)]",
  }[accent ?? "primary"];
  return (
    <div
      className={cn(
        "glass relative overflow-hidden rounded-2xl",
        compact ? "p-2.5 sm:p-5" : "p-5",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="flex items-start justify-between">
        <p
          className={cn(
            "uppercase tracking-wider text-muted-foreground",
            compact ? "text-[9px] sm:text-xs" : "text-xs",
          )}
        >
          {label}
        </p>
        {icon && (
          <div
            className={cn(
              "rounded-lg bg-secondary/60",
              compact ? "hidden p-2 sm:block" : "p-2",
              accentClass,
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <p
        className={cn(
          "font-semibold tracking-tight",
          compact ? "mt-1.5 text-xl sm:mt-3 sm:text-3xl" : "mt-3 text-3xl",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export type RowAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  destructive?: boolean;
};

/**
 * A compact "•••" trigger that reveals row actions (edit/delete/etc.) in a
 * dropdown instead of showing every icon inline. Saves horizontal space on
 * mobile and keeps titles from being squeezed/wrapped awkwardly.
 */
export function RowActions({ actions, className }: { actions: RowAction[]; className?: string }) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={cn("shrink-0", className)}
          aria-label="More actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {actions.map((a, i) => (
          <DropdownMenuItem
            key={i}
            onClick={a.onClick}
            className={cn("gap-2", a.destructive && "text-destructive focus:text-destructive")}
          >
            {a.icon}
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}