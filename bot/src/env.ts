import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. See .env.example.`);
  }
  return value;
}

export const env = {
  discordToken: required('DISCORD_BOT_TOKEN'),
  discordClientId: required('DISCORD_CLIENT_ID'),
  discordGuildId: process.env['DISCORD_GUILD_ID'] ?? '',
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  announceChannelId: process.env['NOVA_ANNOUNCE_CHANNEL_ID'] ?? '',
  currency: process.env['NOVA_CURRENCY'] ?? '£',
};
