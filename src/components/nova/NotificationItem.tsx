import { Bell, CalendarPlus, Goal, Repeat, Trophy } from "lucide-react";
import type { NovaNotification } from "@/lib/nova/api";
import { relativeTime } from "@/lib/nova/dates";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Bell> = {
  goal: Goal,
  transfer: Repeat,
  fixture: CalendarPlus,
  result: Trophy,
  match: CalendarPlus,
};

export function NotificationItem({
  notification,
  onToggleRead,
}: {
  notification: NovaNotification;
  onToggleRead?: (n: NovaNotification) => void;
}) {
  const Icon = ICONS[notification.type] ?? Bell;
  return (
    <button
      type="button"
      onClick={() => onToggleRead?.(notification)}
      className={cn(
        "nova-panel flex w-full items-start gap-3 px-3 py-2.5 text-left",
        !notification.read && "border-border-strong bg-surface-2",
      )}
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-border bg-background">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{notification.title}</span>
          {!notification.read && <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />}
        </span>
        {notification.message && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{notification.message}</span>
        )}
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {notification.type}
          {notification.related_type ? ` · ${notification.related_type}` : ""} ·{" "}
          {relativeTime(notification.created_at)}
        </span>
      </span>
    </button>
  );
}
