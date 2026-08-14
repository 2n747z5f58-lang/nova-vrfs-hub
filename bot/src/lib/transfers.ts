import { db, maybe, must } from '../supabase.js';
import { applyBudget } from './budget.js';
import { getTeamById } from './resolve.js';
import { notifyFavourites } from './notify.js';
import type { Actor } from './perms.js';
import { PermissionError, isStaff, managesTeam } from './perms.js';
import type { Player, TransferOffer } from './types.js';

export const OFFER_ACCEPT = 'nova:offer:accept';
export const OFFER_DECLINE = 'nova:offer:decline';

export async function getOffer(id: string) {
  const offer = maybe<TransferOffer>(
    await db
      .from('transfer_offers')
      .select('id,player_id,from_team_id,to_team_id,offered_by,fee,status')
      .eq('id', id)
      .maybeSingle(),
  );
  if (!offer) throw new Error('That transfer offer no longer exists.');
  return offer;
}

/** Only the selling club (or the player, when a free agent) may respond. */
export function requireOfferResponder(actor: Actor, offer: TransferOffer, player: Player) {
  if (isStaff(actor)) return;
  if (offer.from_team_id && managesTeam(actor, offer.from_team_id)) return;
  if (!offer.from_team_id && actor.player?.id === player.id) return;
  throw new PermissionError(
    offer.from_team_id
      ? 'Only the selling club’s **MANAGER**/**CO-MANAGER** (or staff) can respond to this offer.'
      : 'Only the player (or staff) can respond to a free-agent offer.',
  );
}

/** Completes an accepted offer: money moves, player moves, history is written. */
export async function completeTransfer(offer: TransferOffer, actor: Actor) {
  const player = must<Player>(
    await db
      .from('players')
      .select('id,username,display_name,discord_id,team_id,loan_team_id,position,goals,assists,appearances')
      .eq('id', offer.player_id)
      .maybeSingle() as never,
  );
  const toTeam = await getTeamById(offer.to_team_id);
  const fromTeam = offer.from_team_id ? await getTeamById(offer.from_team_id) : null;
  const fee = Number(offer.fee ?? 0);

  const transfer = must<{ id: string }>(
    (await db
      .from('transfers')
      .insert({
        player_id: player.id,
        from_team_id: fromTeam?.id ?? null,
        to_team_id: toTeam.id,
        transfer_date: new Date().toISOString().slice(0, 10),
        fee,
        status: 'completed',
        completed_at: new Date().toISOString(),
        details: fromTeam ? `${fromTeam.name} → ${toTeam.name}` : `Free agent → ${toTeam.name}`,
      })
      .select('id')
      .single()) as never,
  );

  if (fee > 0) {
    await applyBudget({
      team: toTeam,
      amount: -fee,
      type: 'transfer_out',
      description: `Signed ${player.display_name ?? player.username}`,
      createdBy: actor.profile?.id ?? null,
      relatedTransferId: transfer.id,
    });
    if (fromTeam) {
      await applyBudget({
        team: fromTeam,
        amount: fee,
        type: 'transfer_in',
        description: `Sold ${player.display_name ?? player.username}`,
        createdBy: actor.profile?.id ?? null,
        relatedTransferId: transfer.id,
      });
    }
  }

  const upd = await db
    .from('players')
    .update({ team_id: toTeam.id, loan_team_id: null })
    .eq('id', player.id);
  if (upd.error) throw new Error(upd.error.message);

  await db.from('signings').insert({
    player_id: player.id,
    team_id: toTeam.id,
    previous_team_id: fromTeam?.id ?? null,
    signed_by: actor.profile?.id ?? null,
    details: `Transfer completed via Discord${fee > 0 ? ` for ${fee}` : ''}`,
  });

  await db
    .from('transfer_offers')
    .update({ status: 'accepted', responded_at: new Date().toISOString(), responded_by: actor.profile?.id ?? null })
    .eq('id', offer.id);

  const label = player.display_name ?? player.username;
  await notifyFavourites({
    itemType: 'team',
    itemId: toTeam.id,
    type: 'transfer',
    title: `${toTeam.name} sign ${label}`,
    message: fromTeam ? `From ${fromTeam.name}` : 'Free agent signing',
  });
  if (fromTeam) {
    await notifyFavourites({
      itemType: 'team',
      itemId: fromTeam.id,
      type: 'transfer',
      title: `${label} leaves ${fromTeam.name}`,
      message: `Joins ${toTeam.name}`,
    });
  }
  await notifyFavourites({
    itemType: 'player',
    itemId: player.id,
    type: 'transfer',
    title: `${label} joins ${toTeam.name}`,
  });

  return { player, toTeam, fromTeam, fee };
}

export async function declineOffer(offer: TransferOffer, actor: Actor) {
  await db
    .from('transfer_offers')
    .update({ status: 'declined', responded_at: new Date().toISOString(), responded_by: actor.profile?.id ?? null })
    .eq('id', offer.id);
}
