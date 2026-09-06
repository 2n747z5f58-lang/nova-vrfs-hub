import "dotenv/config";

import {
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  RepliableInteraction,
} from "discord.js";

import {
  handleCommand,
  handleButton,
} from "./commands.js";

import { supabase } from "./database.js";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error("DISCORD_TOKEN is missing.");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
});

/* =========================
   DISCORD OPTIONS SYNC
========================= */

async function syncGuildDiscordOptions(guildId: string) {
  const guild = client.guilds.cache.get(guildId);

  if (!guild) {
    return;
  }

  try {
    const roles = guild.roles.cache
      .filter((role) => !role.managed && role.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        position: role.position,
        color: role.hexColor,
        managed: role.managed,
      }));

    const channels = guild.channels.cache
      .filter((channel) => !channel.isThread())
      .sort((a, b) => a.position - b.position)
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: channel.position,
        parent_id: channel.parentId,
      }));

    const { error } = await supabase
      .from("guild_settings")
      .update({
        guild_name: guild.name,
        discord_roles: roles,
        discord_channels: channels,
      })
      .eq("guild_id", guild.id);

    if (error) {
      console.error(
        `Failed to sync Discord options for ${guild.name}:`,
        error,
      );
      return;
    }

    console.log(
      `Synced Discord options for ${guild.name}: ${roles.length} roles, ${channels.length} channels.`,
    );
  } catch (error) {
    console.error(
      `Discord option sync failed for guild ${guildId}:`,
      error,
    );
  }
}

async function syncAllGuildDiscordOptions() {
  for (const guild of client.guilds.cache.values()) {
    await syncGuildDiscordOptions(guild.id);
  }
}

/* =========================
   READY
========================= */

client.once(
  Events.ClientReady,
  async (readyClient) => {
    console.log(
      `NOVA is online as ${readyClient.user.tag}`,
    );

    await syncAllGuildDiscordOptions();
  },
);

/* =========================
   GUILD EVENTS
========================= */

client.on(
  Events.GuildCreate,
  async (guild) => {
    await syncGuildDiscordOptions(guild.id);
  },
);

client.on(
  Events.GuildUpdate,
  async (guild) => {
    await syncGuildDiscordOptions(guild.id);
  },
);

client.on(
  Events.GuildRoleCreate,
  async (role) => {
    await syncGuildDiscordOptions(role.guild.id);
  },
);

client.on(
  Events.GuildRoleUpdate,
  async (role) => {
    await syncGuildDiscordOptions(role.guild.id);
  },
);

client.on(
  Events.GuildRoleDelete,
  async (role) => {
    await syncGuildDiscordOptions(role.guild.id);
  },
);

client.on(
  Events.ChannelCreate,
  async (channel) => {
    if ("guild" in channel && channel.guild) {
      await syncGuildDiscordOptions(channel.guild.id);
    }
  },
);

client.on(
  Events.ChannelUpdate,
  async (channel) => {
    if ("guild" in channel && channel.guild) {
      await syncGuildDiscordOptions(channel.guild.id);
    }
  },
);

client.on(
  Events.ChannelDelete,
  async (channel) => {
    if ("guild" in channel && channel.guild) {
      await syncGuildDiscordOptions(channel.guild.id);
    }
  },
);

/* =========================
   INTERACTIONS
========================= */

client.on(
  Events.InteractionCreate,
  async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction);
        return;
      }

      if (interaction.isButton()) {
        await handleButton(interaction);
        return;
      }
    } catch (error) {
      console.error(
        "Interaction error:",
        error,
      );

      if (!interaction.isRepliable()) {
        return;
      }

      const replyable =
        interaction as RepliableInteraction;

      try {
        if (
          replyable.replied ||
          replyable.deferred
        ) {
          await replyable.followUp({
            content:
              "❌ Something went wrong while running that NOVA action.",
            ephemeral: true,
          });
        } else {
          await replyable.reply({
            content:
              "❌ Something went wrong while running that NOVA action.",
            ephemeral: true,
          });
        }
      } catch (replyError) {
        console.error(
          "Failed to send error response:",
          replyError,
        );
      }
    }
  },
);

client.login(token);
