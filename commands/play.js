const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play music from YouTube or other sources')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('The song name or URL to play')
        .setRequired(true)),

  async execute(interaction, client) {
    const query = interaction.options.getString('query');
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
    }

    await interaction.deferReply();

    const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
    if (!node) return interaction.editReply('No Lavalink nodes available.');

    let player = client.shoukaku.players.get(interaction.guild.id);

    if (!player) {
      player = await client.shoukaku.joinVoiceChannel({
        guildId: interaction.guild.id,
        channelId: voiceChannel.id,
        shardId: interaction.guild.shardId
      });
      console.log(`Joined voice channel in guild ${interaction.guild.id}`);
    }

    // Centralized event listener setup
    client.setupPlayer(player);

    const res = await node.rest.resolve(query.startsWith('http') ? query : `ytsearch:${query}`);
    console.log(`Search result loadType: ${res?.loadType}`);
    
    if (!res || res.loadType === "empty" || res.loadType === "error") {
      return interaction.editReply('No results found or search failed.');
    }

    // Save channel for announcements
    client.textChannels.set(interaction.guild.id, interaction.channel.id);

    // Initialize queue if it doesn't exist
    if (!client.queue.has(interaction.guild.id)) {
      client.queue.set(interaction.guild.id, { active: [], backlog: [] });
    }

    const queueData = client.queue.get(interaction.guild.id);
    const isPlaying = !!player.track;

    if (res.loadType === "playlist") {
      const tracks = res.data.tracks;
      if (!isPlaying) {
        const firstTrack = tracks.shift();
        const initialBatch = tracks.splice(0, 9); // Take next 9 to make it 10 total (1 playing + 9 queued)
        queueData.active.push(...initialBatch);
        queueData.backlog.push(...tracks); // The rest go to backlog
        
        player.currentTrack = firstTrack; // Essential for NP and event handling
        await player.playTrack({ track: { encoded: firstTrack.encoded } });
        // No explicit "Now playing" string here, sendPlayerController handles it
        await interaction.editReply(`✅ Started playing playlist. **${initialBatch.length}** tracks queued.`);
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      } else {
        const startPos = queueData.active.length + 1;
        // If active queue is small, fill it up to 10
        if (queueData.active.length < 10) {
          const space = 10 - queueData.active.length;
          const toAdd = tracks.splice(0, space);
          queueData.active.push(...toAdd);
          queueData.backlog.push(...tracks);
          await interaction.editReply(`✅ Added **${toAdd.length}** tracks to queue and **${tracks.length}** to backlog. Position start: **#${startPos}**.`);
        } else {
          queueData.backlog.push(...tracks);
          await interaction.editReply(`✅ Added **${tracks.length}** tracks to backlog. They will be queued after current tracks finish.`);
        }
      }
    } else {
      const track = res.loadType === "search" ? res.data[0] : res.data;
      if (!isPlaying) {
        player.currentTrack = track; // Essential for NP and event handling
        client.textChannels.set(interaction.guild.id, interaction.channel.id);
        await player.playTrack({ track: { encoded: track.encoded } });
        await interaction.editReply(`✅ Started playing: **${track.info.title}**`);
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
      } else {
        queueData.active.push(track);
        await interaction.editReply(`✅ Queued at position **#${queueData.active.length}**: ${track.info.title}`);
      }
    }
  }
};