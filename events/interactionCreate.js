module.exports = {
  name: 'interactionCreate',
  execute: async (interaction, client) => {
    console.log('Interaction received:', interaction.commandName);
    if (interaction.isButton()) {
      const player = client.shoukaku.players.get(interaction.guild.id);
      if (!player) return interaction.reply({ content: 'No active player.', ephemeral: true });

      // Consistent voice channel check
      if (!interaction.member.voice.channelId || interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) {
        return interaction.reply({ content: 'You must be in the same voice channel!', ephemeral: true });
      }

      await interaction.deferUpdate();

      const guildId = interaction.guild.id;
      const queueData = client.queue.get(guildId);

      try {
        switch (interaction.customId) {
          case 'player_pause':
            await player.setPaused(!player.paused);
            break;
          case 'player_skip':
            await client.playNext(guildId, player.currentTrack);
            return; // Controller handled by 'start' event
          case 'player_stop':
            await client.shoukaku.leaveVoiceChannel(guildId);
            client.queue.delete(guildId);
            client.textChannels.delete(guildId);
            client.loop.delete(guildId);
            return;
          case 'player_loop':
            const modes = ['off', 'track', 'queue'];
            const currentMode = client.loop.get(guildId) || 'off';
            const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
            client.loop.set(guildId, nextMode);
            break;
          case 'player_shuffle':
            if (queueData && queueData.active.length > 1) {
              for (let i = queueData.active.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [queueData.active[i], queueData.active[j]] = [queueData.active[j], queueData.active[i]];
              }
            }
            break;
        }

        // Update the controller for non-skipping actions
        if (player.currentTrack) {
          await client.sendPlayerController(guildId, player.currentTrack);
        }
      } catch (err) {
        console.error('Button interaction error:', err);
        // Defer already acknowledged, follow up if needed
      }
      return;
    }

    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.log('Command not found');
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'There was an error executing this command!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
      }
    }
  }
};