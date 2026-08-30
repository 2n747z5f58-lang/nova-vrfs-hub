import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { supabase } from "./database.js";
export async function handleCommand(
  interaction: ChatInputCommandInteraction,
) {
  switch (interaction.commandName) {
    case "setup":
      return setup(interaction);
    case "addteam":
      return addTeam(interaction);
    case "makedivision":
      return makeDivision(interaction);
    case "startdivision":
      return startDivision(interaction);
    case "enddivision":
      return endDivision(interaction);
    case "submitresult":
      return simple(interaction, "submitresult");
    case "setcooverseer":
      return simple(interaction, "setcooverseer");
    case "removeoverseer":
      return simple(interaction, "removeoverseer");
    case "transferleague":
      return simple(interaction, "transferleague");
    default:
      return interaction.reply({
        content: "❌ Unknown NOVA command.",
        ephemeral: true,
      });
  }
}
async function setup(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
    return interaction.reply({
      content: "❌ You need Administrator permission.",
      ephemeral: true,
    });
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  if (!guildId)
    return interaction.editReply("❌ Use this inside a server.");
  const leagueName = interaction.options.getString("league", true);
  const divisionNames = [
    interaction.options.getString("division1", true),
    interaction.options.getString("division2"),
    interaction.options.getString("division3"),
  ].filter(Boolean) as string[];
  const slug = leagueName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const { data: existingGuild } = await supabase
    .from("guild_settings")
    .select("id")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (existingGuild)
    return interaction.editReply("⚠️ This server is already connected.");
  const { data: existingLeague } = await supabase
    .from("leagues")
    .select("id")
    .or(`name.ilike.${leagueName},slug.eq.${slug}`)
    .maybeSingle();
  if (existingLeague)
    return interaction.editReply("❌ A league with that name already exists.");
  const { data: league, error } = await supabase
    .from("leagues")
    .insert({ name: leagueName, slug })
    .select()
    .single();
  if (error || !league)
    return interaction.editReply("❌ Couldn't create the league.");
  const { error: guildError } = await supabase
    .from("guild_settings")
    .insert({
      guild_id: guildId,
      league_id: league.id,
    });
  if (guildError) {
    await supabase.from("leagues").delete().eq("id", league.id);
    return interaction.editReply("❌ Couldn't connect this server.");
  }
  for (const name of divisionNames) {
    await supabase.from("divisions").insert({
      league_id: league.id,
      name,
    });
  }
  return interaction.editReply(
    `✅ **${leagueName}** has been created.\n\n` +
    divisionNames.map((d, i) => `${["🥇","🥈","🥉"][i]} ${d}`).join("\n") +
    `\n\n👑 You are now the primary Overseer.\n🌐 Manage the rest through NOVA.`,
  );
}
async function addTeam(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  const teamName = interaction.options.getString("team", true);
  const divisionName = interaction.options.getString("division", true);
  const logo = interaction.options.getAttachment("logo");
  if (!guildId)
    return interaction.editReply("❌ Use this inside a server.");
  const { data: settings } = await supabase
    .from("guild_settings")
    .select("league_id")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (!settings?.league_id)
    return interaction.editReply("❌ This server isn't connected to a league.");
  const { data: division } = await supabase
    .from("divisions")
    .select("id")
    .eq("league_id", settings.league_id)
    .ilike("name", divisionName)
    .maybeSingle();
  if (!division)
    return interaction.editReply(`❌ Division **${divisionName}** doesn't exist.`);
  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("name", teamName)
    .maybeSingle();
  if (existing)
    return interaction.editReply("❌ A team with that name already exists.");
  const { error } = await supabase
    .from("teams")
    .insert({
      name: teamName,
      division_id: division.id,
      logo_url: logo?.url ?? null,
    });
  if (error) {
    console.error(error);
    return interaction.editReply("❌ Couldn't create the team.");
  }
  return interaction.editReply(
    `✅ **${teamName}** added to **${divisionName}**${logo ? " with its logo." : "."}`,
  );
}
async function makeDivision(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId;
  const name = interaction.options.getString("division") ?? "New Division";
  const { data: settings } = await supabase
    .from("guild_settings")
    .select("league_id")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (!settings?.league_id)
    return interaction.editReply("❌ This server isn't connected to a league.");
  const { error } = await supabase.from("divisions").insert({
    league_id: settings.league_id,
    name,
  });
  return interaction.editReply(
    error ? "❌ Couldn't create the division." : `✅ **${name}** created.`,
  );
}
async function startDivision(interaction: ChatInputCommandInteraction) {
  return simple(interaction, "startdivision");
}
async function simple(
  interaction: ChatInputCommandInteraction,
  command: string,
) {
  return interaction.reply({
    content: `🛠️ **/${command}** is being connected to NOVA.`,
    ephemeral: true,
  });
}
