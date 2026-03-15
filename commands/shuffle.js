const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the current active queue'),

  async execute(interaction, client) {
    const player = client.shoukaku.players.get(interaction.guild.id);
    const queueData = client.queue.get(interaction.guild.id);

    if (!player || !queueData || queueData.active.length <= 1) {
      return interaction.reply({ content: 'Queue is too short to shuffle.', ephemeral: true });
    }

    // Consistent voice channel check
    if (!interaction.member.voice.channelId || interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
      return interaction.reply({ content: 'You must be in the same voice channel as me to shuffle!', ephemeral: true });
    }

    // Shuffle only the active queue
    for (let i = queueData.active.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queueData.active[i], queueData.active[j]] = [queueData.active[j], queueData.active[i]];
    }

    await interaction.reply('🔀 Shuffled the active queue.');
  }
};
