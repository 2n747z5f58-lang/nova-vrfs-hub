import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, dayLabel, isoDay, startOfDay } from "@/lib/nova/dates";
import { cn } from "@/lib/utils";

export function DateStrip({
  days,
  selected,
  onSelect,
  counts,
}: {
  days: Date[];
  selected: Date;
  onSelect: (d: Date) => void;
  counts: Record<string, number>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const todayKey = isoDay(new Date());

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selected]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => onSelect(addDays(selected, -1))}
          className="flex h-9 items-center gap-1 rounded-sm border border-border px-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Yesterday
        </button>
        <button
          onClick={() => onSelect(startOfDay(new Date()))}
          className={cn(
            "h-9 rounded-sm px-4 text-xs font-bold uppercase tracking-wider",
            isoDay(selected) === todayKey
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground hover:text-foreground",
          )}
        >
          Today
        </button>
        <button
          onClick={() => onSelect(addDays(selected, 1))}
          className="flex h-9 items-center gap-1 rounded-sm border border-border px-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Tomorrow <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {days.map((day) => {
          const key = isoDay(day);
          const active = key === isoDay(selected);
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              ref={active ? activeRef : undefined}
              onClick={() => onSelect(day)}
              className={cn(
                "flex w-[62px] shrink-0 flex-col items-center gap-0.5 rounded-sm border px-1 py-2",
                active
                  ? "border-foreground bg-surface-2 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
                isToday && !active && "border-border-strong text-foreground",
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {dayLabel(day)}
              </span>
              <span className="text-base font-black tabular-nums leading-none">
                {day.getDate()}
              </span>
              <span className="text-[10px] uppercase">
                {day.toLocaleDateString(undefined, { month: "short" })}
              </span>
              <span
                className={cn(
                  "mt-0.5 h-1.5 w-1.5 rounded-full",
                  (counts[key] ?? 0) > 0 ? "bg-success" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
