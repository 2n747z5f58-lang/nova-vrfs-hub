import { Star } from "lucide-react";
import { useFavourites } from "@/hooks/useFavourites";
import type { FavouriteType } from "@/lib/nova/api";
import { cn } from "@/lib/utils";

export function FavouriteButton({
  type,
  itemId,
  label,
  className,
  size = "default",
}: {
  type: FavouriteType;
  itemId: string;
  label?: string;
  className?: string;
  size?: "default" | "icon";
}) {
  const { isFavourite, toggle, pending } = useFavourites();
  const active = isFavourite(type, itemId);

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={active}
      aria-label={active ? `Remove ${type} from favourites` : `Add ${type} to favourites`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(type, itemId);
      }}
      className={cn(
        "flex shrink-0 items-center justify-center gap-1.5 rounded-md border transition-all duration-200",
        size === "icon" ? "h-9 w-9" : "h-9 px-3 text-xs font-bold uppercase tracking-wider",
        active
          ? "border-accent-green/50 bg-accent-green/10 text-accent-green"
          : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
        className,
      )}
    >
      <Star className={cn("h-4 w-4 transition-transform", active && "fill-current scale-110")} />
      {size === "default" && (label ?? (active ? "Favourited" : "Favourite"))}
    </button>
  );
}
