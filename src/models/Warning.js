const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    moderatorId: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient queries
warningSchema.index({ userId: 1, guildId: 1 });

module.exports = mongoose.model('Warning', warningSchema); 