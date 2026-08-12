import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  addFavourite,
  listFavourites,
  removeFavourite,
  type FavouriteType,
} from "@/lib/nova/api";

export function useFavourites() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const { data } = useQuery({
    queryKey: ["favourites", userId],
    queryFn: () => listFavourites(userId!),
    enabled: !!userId,
  });

  const favourites = data ?? [];

  const toggle = useMutation({
    mutationFn: async (input: { type: FavouriteType; itemId: string }) => {
      if (!userId) throw new Error("Sign in to use favourites");
      const active = favourites.some(
        (f) => f.item_type === input.type && f.item_id === input.itemId,
      );
      if (active) await removeFavourite(userId, input.type, input.itemId);
      else await addFavourite(userId, input.type, input.itemId);
      return !active;
    },
    onSuccess: (added, input) => {
      queryClient.invalidateQueries({ queryKey: ["favourites", userId] });
      toast.success(added ? `Added ${input.type} to favourites` : `Removed ${input.type} from favourites`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    favourites,
    isFavourite: (type: FavouriteType, itemId: string) =>
      favourites.some((f) => f.item_type === type && f.item_id === itemId),
    idsOf: (type: FavouriteType) =>
      favourites.filter((f) => f.item_type === type).map((f) => f.item_id),
    toggle: (type: FavouriteType, itemId: string) => toggle.mutate({ type, itemId }),
    pending: toggle.isPending,
    signedIn: !!userId,
  };
}
