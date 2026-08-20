import { Bell, CalendarPlus, Goal, Repeat, Trophy, ArrowLeftRight } from "lucide-react";
import type { NovaNotification } from "@/lib/nova/api";
import { relativeTime } from "@/lib/nova/dates";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Bell> = {
  goal: Goal,
  transfer: ArrowLeftRight,
  fixture: CalendarPlus,
  result: Trophy,
  match: CalendarPlus,
  signing: Repeat,
  loan: Repeat,
  release: Repeat,
  loan_recall: Repeat,
  transfer_offer: ArrowLeftRight,
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
        "nova-panel flex w-full items-start gap-3 px-4 py-3 text-left transition-all duration-200 hover:border-border-strong",
        !notification.read && "border-accent-green/30 bg-accent-green/5",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border",
          !notification.read ? "bg-accent-green/10 text-accent-green" : "bg-background text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{notification.title}</span>
          {!notification.read && <span className="h-2 w-2 shrink-0 rounded-full bg-accent-green" />}
        </span>
        {notification.message && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{notification.message}</span>
        )}
        <span className="mt-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {notification.type}
          {notification.related_type ? ` · ${notification.related_type}` : ""} ·{" "}
          {relativeTime(notification.created_at)}
        </span>
      </span>
    </button>
  );
}
