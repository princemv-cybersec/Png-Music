module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(`Logged in as ${client.user.tag}`);
    console.log('Guilds:', client.guilds.cache.map(g => g.id));

    const { REST } = require('@discordjs/rest');
    const { Routes } = require('discord-api-types/v10');
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    (async () => {
      try {
        console.log('Started refreshing application (/) commands for guild.');
        await rest.put(Routes.applicationGuildCommands(client.user.id, '678408770488893466'), { body: client.commandsArray });
        console.log('Successfully reloaded application (/) commands for guild.');
      } catch (error) {
        console.error('Error registering commands:', error);
      }
    })();

  }
};