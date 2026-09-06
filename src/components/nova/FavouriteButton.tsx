import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type FavouriteItemType = "player" | "team" | "league";

type FavouriteButtonProps = {
  itemType: FavouriteItemType;
  itemId: string;
  className?: string;
};

export function FavouriteButton({
  itemType,
  itemId,
  className = "",
}: FavouriteButtonProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [favourited, setFavourited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFavourite() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setUserId(null);
        setFavourited(false);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data, error: favouriteError } = await supabase
        .from("favourites")
        .select("id")
        .eq("user_id", user.id)
        .eq("item_type", itemType)
        .eq("item_id", itemId)
        .maybeSingle();

      if (!active) return;

      if (favouriteError) {
        console.error("Failed to load favourite:", favouriteError);
        setError("Couldn't load favourite status.");
      } else {
        setFavourited(Boolean(data));
      }

      setLoading(false);
    }

    void loadFavourite();

    return () => {
      active = false;
    };
  }, [itemId, itemType]);

  async function toggleFavourite() {
    if (saving) return;

    if (!userId) {
      setError("Sign in to save favourites.");
      return;
    }

    setSaving(true);
    setError("");

    if (favourited) {
      const { error: deleteError } = await supabase
        .from("favourites")
        .delete()
        .eq("user_id", userId)
        .eq("item_type", itemType)
        .eq("item_id", itemId);

      if (deleteError) {
        console.error("Failed to remove favourite:", deleteError);
        setError("Couldn't remove this favourite.");
      } else {
        setFavourited(false);
      }
    } else {
      const { error: insertError } = await supabase
        .from("favourites")
        .insert({
          user_id: userId,
          item_type: itemType,
          item_id: itemId,
        });

      if (insertError) {
        console.error("Failed to add favourite:", insertError);
        setError("Couldn't add this favourite.");
      } else {
        setFavourited(true);
      }
    }

    setSaving(false);
  }

  const label = favourited ? "Favourited" : "Favourite";

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => void toggleFavourite()}
        disabled={loading || saving}
        aria-pressed={favourited}
        title={userId ? label : "Sign in to save favourites"}
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 ${
          favourited ? "bg-accent" : "bg-background"
        }`}
      >
        {loading || saving ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Star className={`size-4 ${favourited ? "fill-current" : ""}`} />
        )}

        {loading ? "Loading" : label}
      </button>

      {error && (
        <p className="max-w-[220px] text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
