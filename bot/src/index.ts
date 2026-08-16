import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js';
import { env } from './env.js';
import { commands, commandMap } from './commands/index.js';
import { getActor } from './lib/perms.js';
import { errorEmbed, field, money, successEmbed } from './lib/format.js';
import {
  OFFER_ACCEPT,
  OFFER_DECLINE,
  completeTransfer,
  declineOffer,
  getOffer,
  requireOfferResponder,
} from './lib/transfers.js';
import {
  ROLE_SLOTS,
  SETUP_SELECT,
  getGuildSettings,
  isRoleSlot,
  requireDiscordAdministrator,
  saveRoleSetting,
  setupPanel,
} from './lib/guild-settings.js';
import { db, must } from './supabase.js';
import type { Player } from './lib/types.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const PLAYER_COLS =
  'id,username,display_name,discord_id,team_id,loan_team_id,position,goals,assists,appearances,profile_id';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

client.once(Events.ClientReady, async (c) => {
  console.log(`NOVA bot online as ${c.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(env.discordToken);

  await rest.put(
    Routes.applicationCommands(c.user.id),
    { body: commands.map((command) => command.data.toJSON()) },
  );

  console.log(`Registered ${commands.length} slash commands.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (!command) return;
      await interaction.deferReply({ flags: command.ephemeral ? MessageFlags.Ephemeral : undefined });
      const actor = await getActor(interaction.user.id);
      await command.execute(interaction, actor);
      return;
    }

    if (interaction.isRoleSelectMenu()) {
      const [, , , slot] = interaction.customId.split(':');
      if (!interaction.customId.startsWith(SETUP_SELECT) || !slot || !isRoleSlot(slot)) return;

      await interaction.deferUpdate();
      requireDiscordAdministrator(interaction);
      const guildId = interaction.guildId!;
      const roleId = interaction.values[0] ?? null;
      const settings = await saveRoleSetting({
        guildId,
        guildName: interaction.guild?.name ?? null,
        slot,
        roleId,
        actorDiscordId: interaction.user.id,
      });
      await interaction.editReply(
        setupPanel(
          interaction.guild?.name ?? guildId,
          settings,
          `✅ **${ROLE_SLOTS[slot].label}** ${roleId ? `set to <@&${roleId}>` : 'cleared'} and saved for this server.`,
        ),
      );
      return;
    }

    if (interaction.isButton()) {
      const [action, offerId] = [
        interaction.customId.slice(0, interaction.customId.lastIndexOf(':')),
        interaction.customId.slice(interaction.customId.lastIndexOf(':') + 1),
      ];
      if (action !== OFFER_ACCEPT && action !== OFFER_DECLINE) return;

      await interaction.deferReply();
      const actor = await getActor(interaction.user.id);
      const offer = await getOffer(offerId);
      if (offer.status !== 'pending') {
        throw new Error(`This offer has already been **${offer.status}**.`);
      }

      const player = must<Player>(
        (await db.from('players').select(PLAYER_COLS).eq('id', offer.player_id).maybeSingle()) as never,
      );
      requireOfferResponder(actor, offer, player);
      const label = player.display_name ?? player.username;

      if (action === OFFER_DECLINE) {
        await declineOffer(offer, actor);
        await interaction.message.edit({ components: [] }).catch(() => {});
        await interaction.editReply({
          embeds: [errorEmbed(`The offer for **${label}** was **declined**.`)],
        });
        return;
      }

      const done = await completeTransfer(offer, actor);
      await interaction.message.edit({ components: [] }).catch(() => {});
      await interaction.editReply({
        embeds: [
          successEmbed('Transfer complete', `**${label}** has signed for **${done.toTeam.name}**.`).addFields(
            field('From', done.fromTeam?.name ?? 'Free agent'),
            field('Fee', done.fee > 0 ? money(done.fee) : 'Free'),
          ),
        ],
      });
    }
  } catch (error) {
    const embed = errorEmbed(messageOf(error));
    try {
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [embed], components: [] });
        } else {
          await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
      }
    } catch (replyError) {
      console.error('Failed to report error to Discord:', replyError);
    }
    console.error(error);
  }
});

client.login(env.discordToken);
