import { REST, Routes } from 'discord.js';
import { env } from './env.js';
import { commands } from './commands/index.js';

const body = commands.map((c) => c.data.toJSON());
const rest = new REST({ version: '10' }).setToken(env.discordToken);

async function main() {
  if (env.discordGuildId) {
    await rest.put(Routes.applicationGuildCommands(env.discordClientId, env.discordGuildId), { body });
    console.log(`Registered ${body.length} commands to guild ${env.discordGuildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(env.discordClientId), { body });
    console.log(`Registered ${body.length} global commands (may take up to an hour to appear).`);
  }
}

main().catch((error) => {
  console.error('Failed to register commands:', error);
  process.exit(1);
});
