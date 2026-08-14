import { EmbedBuilder } from 'discord.js';
import { env } from '../env.js';

export const BRAND = 0x00e0b8;
export const DANGER = 0xff4d5e;
export const OK = 0x4ade80;

export function money(amount: number) {
  return `${env.currency}${Number(amount ?? 0).toLocaleString('en-GB')}`;
}

export function novaEmbed(title: string, description?: string, color = BRAND) {
  const e = new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
  if (description) e.setDescription(description);
  e.setFooter({ text: 'NOVA VRFS' });
  return e;
}

export function errorEmbed(message: string) {
  return novaEmbed('Action failed', message, DANGER);
}

export function successEmbed(title: string, message?: string) {
  return novaEmbed(title, message, OK);
}

export function field(name: string, value: string, inline = true) {
  return { name, value: value || '—', inline };
}
