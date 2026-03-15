const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('See what is currently playing'),

  async execute(interaction, client) {
    const player = client.shoukaku.players.get(interaction.guild.id);
    if (!player || !player.track) {
      return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
    }

    const track = player.currentTrack;
    const queueData = client.queue.get(interaction.guild.id);
    const loopMode = client.loop.get(interaction.guild.id) || 'off';

    const embed = new EmbedBuilder()
      .setTitle('Now Playing')
      .setDescription(`[${track.info.title}](${track.info.uri})`)
      .setThumbnail(track.info.artworkUrl || null)
      .addFields(
        { name: 'Author', value: track.info.author, inline: true },
        { name: 'Loop Mode', value: loopMode.charAt(0).toUpperCase() + loopMode.slice(1), inline: true },
        { name: 'Upcoming in Active', value: `${queueData?.active.length || 0} tracks`, inline: true },
        { name: 'Total in Backlog', value: `${queueData?.backlog.length || 0} tracks`, inline: true }
      )
      .setColor('#0099ff');

    await interaction.reply({ embeds: [embed] });
  }
};
