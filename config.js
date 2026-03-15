module.exports = {
  token: process.env.DISCORD_TOKEN,
  prefix: "/",
  lavalink: {
    host: process.env.LAVALINK_HOST,
    port: Number(process.env.LAVALINK_PORT),
    password: process.env.LAVALINK_PASSWORD,
    path: "/v4/websocket",   // Important for Lavalink v4
    secure: false
  }
};