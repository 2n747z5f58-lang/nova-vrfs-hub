import type {
  ChatInputCommandInteraction,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import type { Actor } from './perms.js';

export interface NovaCommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  /** Replies are already deferred (ephemeral: false) when execute runs. */
  execute(interaction: ChatInputCommandInteraction, actor: Actor): Promise<void>;
}
