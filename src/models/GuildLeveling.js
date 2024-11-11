const mongoose = require('mongoose');

const levelRewardSchema = new mongoose.Schema({
    level: {
        type: Number,
        required: true
    },
    roleId: {
        type: String,
        required: true
    }
});

const guildLevelingSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    enabled: {
        type: Boolean,
        default: true
    },
    xpRate: {
        type: Number,
        default: 1.0 // Multiplier for XP gain
    },
    baseXP: {
        type: Number,
        default: 15 // Base XP per message
    },
    voiceXP: {
        type: Number,
        default: 10 // XP per minute in voice
    },
    cooldown: {
        type: Number,
        default: 60 // Seconds between XP gains
    },
    announceChannel: {
        type: String,
        required: false
    },
    announceDM: {
        type: Boolean,
        default: false
    },
    announceMessage: {
        type: String,
        default: '🎉 Congratulations {user}! You\'ve reached level {level}!'
    },
    levelRoles: [levelRewardSchema],
    excludedChannels: [{
        type: String
    }],
    excludedRoles: [{
        type: String
    }]
});

module.exports = mongoose.model('GuildLeveling', guildLevelingSchema); 