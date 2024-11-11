const GuildSettings = require('../models/GuildSettings');

class Logger {
    static async logModeration(guild, options) {
        try {
            const settings = await GuildSettings.findOne({ guildId: guild.id });
            if (!settings?.logChannel) return;

            const logChannel = await guild.channels.fetch(settings.logChannel);
            if (!logChannel) return;

            const embed = {
                color: options.color || 0x2C2F33,
                description: options.description,
                fields: options.fields || [],
            };

            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error logging moderation action:', error);
        }
    }
}

module.exports = Logger; 