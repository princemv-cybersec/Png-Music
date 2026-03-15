const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the volume')
    .addIntegerOption(option =>
      option.setName('level')
        .setDescription('Volume level (1-200)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(200)),

  async execute(interaction, client) {
    const player = client.shoukaku.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Nothing playing.', ephemeral: true });

    // Consistent voice channel check
    if (!interaction.member.voice.channelId || interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
      return interaction.reply({ content: 'You must be in the same voice channel as me to change the volume!', ephemeral: true });
    }

    const vol = interaction.options.getInteger('level');

    await player.setGlobalVolume(vol);
    await interaction.reply(`🔊 Volume set to ${vol}%`);
  }
};