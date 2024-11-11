const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    lastMessageTimestamp: {
        type: Date,
        default: null
    },
    xp: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 0
    },
    voiceTime: {
        type: Number,
        default: 0
    },
    lastVoiceJoinTimestamp: {
        type: Date,
        default: null
    },
    badges: [{
        type: String,
        enum: ['early_supporter', 'active_chatter', 'voice_enthusiast', 'event_participant']
    }],
    achievements: [{
        name: String,
        unlockedAt: Date
    }]
});

userSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema); 