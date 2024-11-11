const mongoose = require('mongoose');

const appealSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    reason: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'denied'], 
        default: 'pending' 
    },
    createdAt: { type: Date, default: Date.now },
    decidedAt: { type: Date },
    decidedBy: { type: String },
    banReason: { type: String },
    messageId: { type: String }, // Store appeal message ID for reference
    cooldownUntil: { type: Date }
});

// Index for querying recent appeals
appealSchema.index({ userId: 1, guildId: 1, createdAt: -1 });

module.exports = mongoose.model('Appeal', appealSchema); 