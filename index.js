require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Shoukaku, Connectors } = require('shoukaku');
const fs = require('fs');

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Setup Shoukaku Manager
const nodes = [
  {
    name: 'Main Node',
    url: '127.0.0.1:2333',
    auth: 'youshallnotpass',
    secure: false
  }
];

client.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes);
client.players = new Map();
client.queue = new Map(); // Store { active: [], backlog: [] }
client.textChannels = new Map();
client.loop = new Map(); // Store 'off', 'track', or 'queue'
client.playerMessages = new Map(); // Store message IDs for dynamic updates
client.controllerLocks = new Map(); // Prevent race conditions
client.controllerIntervals = new Map(); // For live progress bar updates
client.idleTimers = new Map(); // For idle disconnection

// Helpers
const formatTime = (ms) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const createProgressBar = (current, total, size = 15) => {
  const progress = Math.round((size * current) / total);
  const empty = size - progress;
  const progressCircle = '🟢';
  const emptyBar = '▬';
  const filledBar = '▬';
  return `${filledBar.repeat(progress)}${progressCircle}${emptyBar.repeat(empty)}`;
};

// Shoukaku event listeners
client.shoukaku.on('ready', (name) => console.log(`Node "${name}" connected.`));
client.shoukaku.on('error', (name, error) => console.log(`Node "${name}" encountered an error: ${error.message}.`));

// Function to send/update the player controller message
const sendPlayerController = async (guildId, track, forceNew = false) => {
  // Simple serialization lock to prevent doubling/race conditions
  const currentLock = client.controllerLocks.get(guildId) || Promise.resolve();
  
  const newLock = currentLock.then(async () => {
    try {
      const channelId = client.textChannels.get(guildId);
      if (!channelId) return;

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) return;

      const player = client.shoukaku.players.get(guildId);
      if (!player) return;

      const loopMode = client.loop.get(guildId) || 'off';
      const position = player.position || 0;
      const duration = track.info.length || 0;

      const embed = new EmbedBuilder()
        .setAuthor({ name: 'NOW PLAYING', iconURL: client.user.displayAvatarURL() })
        .setTitle(track.info.title)
        .setURL(track.info.uri)
        .setThumbnail(track.info.artworkUrl || null)
        .addFields(
          { name: 'Artist', value: `\`${track.info.author}\``, inline: true },
          { name: 'Loop Mode', value: `\`${loopMode.charAt(0).toUpperCase() + loopMode.slice(1)}\``, inline: true },
          { name: '\u200b', value: `${formatTime(position)} ${createProgressBar(position, duration)} ${formatTime(duration)}`, inline: false }
        )
        .setColor('#1DB954') // Spotify Green
        .setFooter({ text: `Volume: ${player.volume}% • Source: ${track.info.sourceName}` });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('player_shuffle')
            .setEmoji('🔀')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('player_skip')
            .setEmoji('⏭️')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('player_pause')
            .setEmoji(player.paused ? '▶️' : '⏸️')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('player_loop')
            .setEmoji('🔁')
            .setStyle(loopMode !== 'off' ? ButtonStyle.Success : ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('player_stop')
            .setEmoji('⏺')
            .setStyle(ButtonStyle.Danger)
        );

      const oldMessageId = client.playerMessages.get(guildId);

      // If NOT forcing new, try to edit
      if (!forceNew && oldMessageId) {
        try {
          const oldMessage = await channel.messages.fetch(oldMessageId).catch(() => null);
          if (oldMessage) {
            await oldMessage.edit({ embeds: [embed], components: [row], files: [] });
            return;
          }
        } catch (e) {}
      }

      // Fresh send: Delete old first
      if (oldMessageId) {
        try {
          const oldMessage = await channel.messages.fetch(oldMessageId).catch(() => null);
          if (oldMessage) await oldMessage.delete().catch(() => {});
        } catch (e) {}
        client.playerMessages.delete(guildId);
      }

      const newMessage = await channel.send({ 
        embeds: [embed], 
        components: [row]
      }).catch(console.error);
      
      if (newMessage) {
        client.playerMessages.set(guildId, newMessage.id);
      }
    } catch (err) {
      console.error('Controller update failed:', err);
    }
  }).catch(console.error);

  client.controllerLocks.set(guildId, newLock);
  return newLock;
};

// Timer management for live progress bar
const stopControllerTimer = (guildId) => {
  const interval = client.controllerIntervals.get(guildId);
  if (interval) {
    clearInterval(interval);
    client.controllerIntervals.delete(guildId);
  }
};

const startControllerTimer = (guildId, track) => {
  stopControllerTimer(guildId);
  const interval = setInterval(async () => {
    const player = client.shoukaku.players.get(guildId);
    if (!player || player.paused) return;
    await sendPlayerController(guildId, track, false);
  }, 10000); // Update every 10 seconds to avoid rate limits
  client.controllerIntervals.set(guildId, interval);
};

// Idle management
const stopIdleTimer = (guildId) => {
  const timer = client.idleTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    client.idleTimers.delete(guildId);
  }
};

const startIdleTimer = (guildId) => {
  stopIdleTimer(guildId);
  const timer = setTimeout(async () => {
    console.log(`Idle timeout reached for guild ${guildId}. Leaving...`);
    await client.shoukaku.leaveVoiceChannel(guildId);
    client.queue.delete(guildId);
    client.textChannels.delete(guildId);
    client.loop.delete(guildId);
    client.playerMessages.delete(guildId);
    client.idleTimers.delete(guildId);
  }, 120000); // 2 minutes
  client.idleTimers.set(guildId, timer);
};

// Function to attach event listeners to a player
const setupPlayer = (player) => {
  if (player.listenersAttached) return;
  player.listenersAttached = true;

  player.on('start', async (data) => {
    stopIdleTimer(player.guildId);
    player.currentTrack = data.track;
    await sendPlayerController(player.guildId, data.track, true);
    startControllerTimer(player.guildId, data.track);
  });

  player.on('end', async (data) => {
    stopControllerTimer(player.guildId);
    if (data.reason === 'replaced') return;
    await playNext(player.guildId, player.currentTrack);
  });

  player.on('exception', async (err) => {
    stopControllerTimer(player.guildId);
    console.error(`Player error in guild ${player.guildId}:`, err);
    await playNext(player.guildId);
  });

  player.on('closed', (data) => {
    stopControllerTimer(player.guildId);
    const channelId = client.textChannels.get(player.guildId);
    if (channelId) {
      const channel = client.channels.cache.get(channelId);
      const msgId = client.playerMessages.get(player.guildId);
      if (channel && msgId) {
        channel.messages.fetch(msgId).then(m => m.delete().catch(() => {})).catch(() => {});
      }
    }
    client.queue.delete(player.guildId);
    client.textChannels.delete(player.guildId);
    client.loop.delete(player.guildId);
    client.playerMessages.delete(player.guildId);
  });
};

// Function to handle track ending and queue logic
const playNext = async (guildId, lastTrack = null) => {
  const queueData = client.queue.get(guildId);
  const player = client.shoukaku.players.get(guildId);
  const loopMode = client.loop.get(guildId) || 'off';
  
  if (!queueData || !player) return;

  // Handle looping
  if (lastTrack) {
    if (loopMode === 'track') {
      return await player.playTrack({ track: { encoded: lastTrack.encoded } });
    } else if (loopMode === 'queue') {
      queueData.backlog.push(lastTrack);
    }
  }

  // Refill active queue if empty
  if (queueData.active.length === 0 && queueData.backlog.length > 0) {
    const nextBatch = queueData.backlog.splice(0, 10);
    queueData.active.push(...nextBatch);
  }

  if (queueData.active.length === 0) {
    stopControllerTimer(guildId);
    startIdleTimer(guildId);
    const oldMsgId = client.playerMessages.get(guildId);
    if (oldMsgId) {
      const channelId = client.textChannels.get(guildId);
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        channel.messages.fetch(oldMsgId).then(m => m.delete().catch(() => {})).catch(() => {});
      }
    }
    await client.shoukaku.leaveVoiceChannel(guildId);
    client.queue.delete(guildId);
    client.textChannels.delete(guildId);
    client.loop.delete(guildId);
    client.playerMessages.delete(guildId);
    return;
  }

  const nextTrack = queueData.active.shift();
  
  try {
    player.currentTrack = nextTrack;
    await player.playTrack({ track: { encoded: nextTrack.encoded } });
  } catch (err) {
    console.error(`Failed to play ${nextTrack.info.title}:`, err);
    await playNext(guildId);
  }
};

// Expose utilities to commands
client.playNext = playNext;
client.setupPlayer = setupPlayer;
client.sendPlayerController = sendPlayerController;

// Global Connection Monitoring
client.shoukaku.on('error', (name, error) => console.log(`[Shoukaku] Node "${name}" error: ${error.message}`));
client.shoukaku.on('ready', (name) => console.log(`[Shoukaku] Node "${name}" connected`));
client.shoukaku.on('close', (name, code, reason) => console.log(`[Shoukaku] Node "${name}" closed: ${code} ${reason}`));
client.shoukaku.on('disconnect', (name, players, moved) => console.log(`[Shoukaku] Node "${name}" disconnected`));

// Load commands
client.commands = new Map();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

client.commandsArray = commands;

// Load events
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(`./events/${file}`);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Prefix execution helper
const handlePrefixCommand = async (message) => {
  if (!message.content.startsWith('!') || message.author.bot) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  // Mock interaction-like object for code reuse
  const mockInteraction = {
    guild: message.guild,
    member: message.member,
    channel: message.channel,
    options: {
      getString: (name) => {
        if (name === 'query' || name === 'link') return args.join(' ');
        if (name === 'mode') return args[0];
        return null;
      },
      getInteger: () => parseInt(args[0]),
    },
    reply: async (payload) => {
      const msg = await message.reply(payload);
      // Auto-delete if it's a simple confirmation
      if (typeof payload === 'string' && payload.includes('✅')) {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      }
      return msg;
    },
    editReply: async (payload) => {
      const msg = await message.reply(payload);
      if (typeof payload === 'string' && payload.includes('✅')) {
        setTimeout(() => msg.delete().catch(() => {}), 5000);
      }
      return msg;
    },
    deferReply: async () => {}, // Message commands don't strictly need defer but play.js uses it
    deleteReply: async () => {}
  };

  try {
    await command.execute(mockInteraction, client);
  } catch (err) {
    console.error(`Prefix command error (${commandName}):`, err);
  }
};

client.on('messageCreate', handlePrefixCommand);

// Login
client.login(process.env.DISCORD_TOKEN);

