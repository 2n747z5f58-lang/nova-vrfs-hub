import { db } from '../supabase.js';
import type { Team } from './types.js';

export type TxType = 'transfer_in' | 'transfer_out' | 'adjustment' | 'signing' | 'release';

/**
 * Moves money and writes the ledger entry. `amount` is positive for money in,
 * negative for money out. Never let a team go below zero on a spend.
 */
export async function applyBudget(input: {
  team: Team;
  amount: number;
  type: TxType;
  description?: string;
  createdBy?: string | null;
  relatedTransferId?: string | null;
}) {
  const next = Number(input.team.budget ?? 0) + input.amount;
  if (next < 0) {
    throw new Error(`**${input.team.name}** cannot afford this — budget would go negative.`);
  }
  const up = await db.from('teams').update({ budget: next }).eq('id', input.team.id);
  if (up.error) throw new Error(up.error.message);

  const tx = await db.from('budget_transactions').insert({
    team_id: input.team.id,
    transaction_type: input.type,
    amount: input.amount,
    description: input.description ?? null,
    created_by: input.createdBy ?? null,
    related_transfer_id: input.relatedTransferId ?? null,
  });
  if (tx.error) throw new Error(tx.error.message);
  return next;
}
