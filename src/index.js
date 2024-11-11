const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const { initializeBot } = require('./utils/initialize');
const SpamManager = require('./structures/SpamManager');
const LevelingManager = require('./structures/LevelingManager');

require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
        Partials.Reaction,
        Partials.ThreadMember
    ]
});

client.commands = new Collection();
client.cooldowns = new Collection();
client.spamManager = new SpamManager();
client.levelingManager = new LevelingManager(client);
client.giveaways = new Collection();

initializeBot(client);

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Add debug logging
client.on('debug', info => {
    if (info.includes('Hit a 429')) {
        console.error('Rate limit hit:', info);
    }
});

client.on('error', error => {
    console.error('Client error:', error);
}); 