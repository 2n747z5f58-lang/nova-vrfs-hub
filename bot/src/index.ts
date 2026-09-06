import "dotenv/config";

import {
  Client,
  Events,
  GatewayIntentBits,
} from "discord.js";

import {
  handleCommand,
  handleButton,
} from "./commands.js";

const token =
  process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error(
    "DISCORD_TOKEN is missing.",
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(
  Events.ClientReady,
  (readyClient) => {
    console.log(
      `NOVA is online as ${readyClient.user.tag}`,
    );
  },
);

client.on(
  Events.InteractionCreate,
  async (interaction) => {
    try {
      if (
        interaction.isChatInputCommand()
      ) {
        await handleCommand(
          interaction,
        );

        return;
      }

      if (
        interaction.isButton()
      ) {
        await handleButton(
          interaction,
        );

        return;
      }
    } catch (error) {
      console.error(
        "Interaction error:",
        error,
      );

      try {
        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.followUp({
            content:
              "❌ Something went wrong while running that NOVA action.",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
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
