import {
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
if (!token || !clientId) {
  throw new Error(
    "DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are required.",
  );
}
const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Create and connect a NOVA league")
    .addStringOption((option) =>
      option
        .setName("league")
        .setDescription("League name")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("division1")
        .setDescription("Division 1")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("division2")
        .setDescription("Optional Division 2")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("division3")
        .setDescription("Optional Division 3")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("addteam")
    .setDescription("Add a team to your league")
    .addStringOption((option) =>
      option
        .setName("team")
        .setDescription("Team name")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("division")
        .setDescription("Division")
        .setRequired(true),
    )
    .addAttachmentOption((option) =>
      option
        .setName("logo")
        .setDescription("Team logo")
        .setRequired(false),
    ),
  new SlashCommandBuilder()
    .setName("makedivision")
    .setDescription("Create a division"),
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
    .setName("setcooverseer")
    .setDescription("Add a Co-Overseer"),
  new SlashCommandBuilder()
    .setName("removeoverseer")
    .setDescription("Remove a Co-Overseer"),
  new SlashCommandBuilder()
    .setName("transferleague")
    .setDescription("Transfer league ownership"),
].map((command) => command.toJSON());
const rest = new REST({ version: "10" }).setToken(token);
try {
  console.log("Registering NOVA slash commands globally...");
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: commands },
  );
  console.log("✅ NOVA slash commands registered successfully.");
} catch (error) {
  console.error("❌ Failed to register NOVA slash commands:", error);
  process.exit(1);
}
