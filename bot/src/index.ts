import "dotenv/config";
import {
  Client,
  Events,
  GatewayIntentBits,
} from "discord.js";
import { handleCommand } from "./commands.js";

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error("DISCORD_TOKEN is missing.");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`NOVA is online as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error("Command error:", error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "Something went wrong while running that command.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "Something went wrong while running that command.",
        ephemeral: true,
      });
    }
  }
});

client.login(token);
