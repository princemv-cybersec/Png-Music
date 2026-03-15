const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the player and clear the queue'),

  async execute(interaction, client) {
    const player = client.shoukaku.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Nothing playing.', ephemeral: true });

    // Consistent voice channel check
    if (!interaction.member.voice.channelId || interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
      return interaction.reply({ content: 'You must be in the same voice channel as me to stop the player!', ephemeral: true });
    }

    await client.shoukaku.leaveVoiceChannel(interaction.guild.id);
    client.queue.delete(interaction.guild.id);
    client.textChannels.delete(interaction.guild.id);
    client.loop.delete(interaction.guild.id);
    await interaction.reply('🛑 Stopped and left the channel.');
  }
};