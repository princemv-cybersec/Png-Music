const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('See the current music queue'),

  async execute(interaction, client) {
    const player = client.shoukaku.players.get(interaction.guild.id);
    const queueData = client.queue.get(interaction.guild.id);

    if (!player || !queueData) {
      return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Music Queue for ${interaction.guild.name}`)
      .setColor('#0099ff');

    let description = '';

    // Active tracks
    const active = queueData.active.slice(0, 10);
    if (active.length > 0) {
      description += `**Next Up:**\n` + active.map((t, i) => `${i + 1}. ${t.info.title}`).join('\n') + '\n\n';
    } else if (queueData.backlog.length === 0) {
      description += 'The queue is empty after this song.\n\n';
    }

    // Backlog summary
    if (queueData.backlog.length > 0) {
      description += `*...and ${queueData.backlog.length} more tracks in the backlog.*`;
    }

    embed.setDescription(description || 'Queue is currently empty.');
    
    await interaction.reply({ embeds: [embed] });
  }
};