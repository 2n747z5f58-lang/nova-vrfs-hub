import { db } from '../supabase.js';

export type FavouriteType = 'league' | 'team' | 'player';

/** Creates in-app notifications for every user following an item. */
export async function notifyFavourites(input: {
  itemType: FavouriteType;
  itemId: string;
  type: string;
  title: string;
  message?: string;
}) {
  const { data, error } = await db
    .from('favourites')
    .select('user_id')
    .eq('item_type', input.itemType)
    .eq('item_id', input.itemId);
  if (error) return 0;
  const users = [...new Set((data ?? []).map((r) => r.user_id as string))];
  if (users.length === 0) return 0;
  const res = await db.from('notifications').insert(
    users.map((user_id) => ({
      user_id,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      related_type: input.itemType,
      related_id: input.itemId,
    })),
  );
  if (res.error) return 0;
  return users.length;
}

/** Notifies a single profile (used for transfer offers and recalls). */
export async function notifyProfile(input: {
  profileId: string;
  type: string;
  title: string;
  message?: string;
  relatedType?: string;
  relatedId?: string;
}) {
  await db.from('notifications').insert({
    user_id: input.profileId,
    type: input.type,
    title: input.title,
    message: input.message ?? null,
    related_type: input.relatedType ?? null,
    related_id: input.relatedId ?? null,
  });
}
