import "dotenv/config";
import {
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error(
    "DISCORD_TOKEN, DISCORD_CLIENT_ID and DISCORD_GUILD_ID are required.",
  );
}

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Set up a NOVA league"),

  new SlashCommandBuilder()
    .setName("addteam")
    .setDescription("Add a team to a NOVA league"),

  new SlashCommandBuilder()
    .setName("removeteam")
    .setDescription("Remove a team from a NOVA league"),

  new SlashCommandBuilder()
    .setName("makedivision")
    .setDescription("Create a league division"),

  new SlashCommandBuilder()
    .setName("startdivision")
    .setDescription("Start a division"),

  new SlashCommandBuilder()
    .setName("enddivision")
    .setDescription("End a division"),

  new SlashCommandBuilder()
    .setName("submitresult")
    .setDescription("Submit a match result"),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View a player's profile"),

  new SlashCommandBuilder()
    .setName("table")
    .setDescription("Generate the current league table"),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

await rest.put(
  Routes.applicationGuildCommands(clientId, guildId),
  { body: commands },
);

console.log("NOVA slash commands registered.");
