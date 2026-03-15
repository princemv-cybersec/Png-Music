const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Clear the entire music queue'),

  async execute(interaction, client) {
    const queueData = client.queue.get(interaction.guild.id);

    if (!queueData || (queueData.active.length === 0 && queueData.backlog.length === 0)) {
      return interaction.reply({ content: 'Queue is already empty.', ephemeral: true });
    }

    // Consistent voice channel check
    if (!interaction.member.voice.channelId || interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
      return interaction.reply({ content: 'You must be in the same voice channel as me to clear the queue!', ephemeral: true });
    }

    queueData.active = [];
    queueData.backlog = [];

    await interaction.reply('🗑 Cleared the entire queue.');
  }
};
