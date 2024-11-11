const mongoose = require('mongoose');

const guildSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    welcomeChannel: String,
    logChannel: String,
    appealChannelId: String,
    ticketChannelId: String,
    ticketLogChannelId: String,
    verificationChannel: String,
    verificationMessage: String,
    verifiedRole: String,
    unverifiedRole: String,
    welcomeConfig: {
        enabled: { type: Boolean, default: false },
        title: String,
        description: String,
        bannerUrl: String,
        color: Number
    },
    levelingConfig: {
        enabled: { type: Boolean, default: false },
        xpRate: { type: Number, default: 1 },
        baseXP: { type: Number, default: 15 },
        voiceXP: { type: Number, default: 10 },
        cooldown: { type: Number, default: 60 },
        rewards: [{
            level: Number,
            roleId: String
        }]
    },
    ticketConfig: {
        supportRoleId: String,
        managerRoleId: String
    },
    giveawayChannel: {
        type: String,
        default: null
    }
});

module.exports = mongoose.model('GuildSettings', guildSettingsSchema); 