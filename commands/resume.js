const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused track'),

  async execute(interaction, client) {
    const player = client.shoukaku.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Nothing playing.', ephemeral: true });

    // Consistent voice channel check
    if (!interaction.member.voice.channelId || interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
      return interaction.reply({ content: 'You must be in the same voice channel as me to resume!', ephemeral: true });
    }

    await player.setPaused(false);
    await interaction.reply('▶ Resumed.');
  }
};