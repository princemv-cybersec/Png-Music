const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track'),

  async execute(interaction, client) {
    const player = client.shoukaku.players.get(interaction.guild.id);

    if (!player) return interaction.reply({ content: 'Nothing playing.', ephemeral: true });

    // Reliable check using Discord.js voice states
    const botChannelId = interaction.guild.members.me.voice.channelId;
    if (!interaction.member.voice.channelId || interaction.member.voice.channelId !== botChannelId) {
      return interaction.reply({ content: 'You must be in the same voice channel as me to skip!', ephemeral: true });
    }

    try {
      // Calling playNext with the current track will trigger a skip 
      // by playing the next track, which replaces the current one.
      await client.playNext(interaction.guild.id, player.currentTrack);
      await interaction.reply('⏭ Skipped current track.');
    } catch (error) {
      console.error('Skip failed:', error);
      await interaction.reply({ content: 'Failed to skip the track.', ephemeral: true });
    }
  }
};