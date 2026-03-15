const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set the loop mode')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('The loop mode')
        .setRequired(true)
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )),

  async execute(interaction, client) {
    const player = client.shoukaku.players.get(interaction.guild.id);
    if (!player) return interaction.reply({ content: 'Nothing playing.', ephemeral: true });

    // Consistent voice channel check
    if (!interaction.member.voice.channelId || interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
      return interaction.reply({ content: 'You must be in the same voice channel as me to change the loop mode!', ephemeral: true });
    }

    const mode = interaction.options.getString('mode');
    client.loop.set(interaction.guild.id, mode);

    await interaction.reply(`🔁 Loop mode set to: **${mode.charAt(0).toUpperCase() + mode.slice(1)}**`);
  }
};
