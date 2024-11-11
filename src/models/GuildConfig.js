const mongoose = require('mongoose');

const guildConfigSchema = new mongoose.Schema({
    guildId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    appealChannelId: { 
        type: String,
        required: false
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date 
    },
    updatedBy: { 
        type: String 
    }
});

// Add indexes
guildConfigSchema.index({ guildId: 1 });

// Add this for debugging
guildConfigSchema.pre('save', function(next) {
    console.log('Saving guild config:', this);
    next();
});

const GuildConfig = mongoose.model('GuildConfig', guildConfigSchema);

module.exports = GuildConfig; 