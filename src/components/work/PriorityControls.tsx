import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRIORITY_META, type Priority } from "./work-helpers";

export function PriorityPicker({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (v: Priority) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={value === null ? "default" : "outline"}
        onClick={() => onChange(null)}
        className="flex-1"
      >
        None
      </Button>
      {(["low", "medium", "high"] as const).map((p) => (
        <Button
          key={p}
          type="button"
          size="sm"
          variant={value === p ? "default" : "outline"}
          onClick={() => onChange(p)}
          className="flex-1"
        >
          {PRIORITY_META[p].label}
        </Button>
      ))}
    </div>
  );
}

/** A small always-visible control to change priority in one click/tap,
 * without opening the full Edit dialog. */
export function QuickPriorityMenu({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (v: Priority) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={
            value ? `Priority: ${PRIORITY_META[value].label}. Change priority` : "Set priority"
          }
          title={value ? `Priority: ${PRIORITY_META[value].label}` : "Set priority"}
          className={cn(
            "shrink-0 h-2.5 w-2.5 rounded-full border transition-colors",
            value
              ? cn(PRIORITY_META[value].dotClass, "border-transparent")
              : "border-muted-foreground/40 hover:border-foreground",
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onChange(null)}>None</DropdownMenuItem>
        {(["low", "medium", "high"] as const).map((p) => (
          <DropdownMenuItem
            key={p}
            onClick={() => onChange(p)}
            className={PRIORITY_META[p].textClass}
          >
            {PRIORITY_META[p].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}