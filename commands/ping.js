const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),

  async execute(interaction, client) {
    console.log('Ping command executed');
    await interaction.reply('Pong!');
  }
};