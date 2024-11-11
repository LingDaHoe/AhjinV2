const Warning = require('../models/Warning');
const { EmbedBuilder } = require('discord.js');

async function createWarning({ userId, guildId, moderatorId, reason }) {
    try {
        const warning = new Warning({
            userId,
            guildId,
            moderatorId,
            reason,
            timestamp: new Date()
        });
        
        await warning.save();
        return warning;
    } catch (error) {
        console.error('Error creating warning:', error);
        throw error;
    }
}

async function createModLogEntry(guild, data) {
    const logChannel = guild.channels.cache.find(
        channel => channel.name === 'mod-logs'
    );

    if (!logChannel) return;

    const colors = {
        WARN: 0x438BEF,
        TIMEOUT: 0x438BEF,
        KICK: 0x438BEF,
        BAN: 0x438BEF,
        UNBAN: 0x438BEF
    };

    const embed = new EmbedBuilder()
        .setColor(colors[data.type])
        .setTitle(`${getModActionEmoji(data.type)} ${data.type}`)
        .addFields(
            { name: 'User', value: `${data.target.tag} (${data.target.id})` },
            { name: 'Moderator', value: `${data.moderator.tag} (${data.moderator.id})` },
            { name: 'Reason', value: data.reason }
        )
        .setTimestamp();

    if (data.duration) {
        embed.addFields({ name: 'Duration', value: data.duration });
    }

    if (data.additionalInfo) {
        embed.addFields({ name: 'Additional Info', value: data.additionalInfo });
    }

    await logChannel.send({ embeds: [embed] });
}

function getModActionEmoji(type) {
    const emojis = {
        WARN: '⚠️',
        TIMEOUT: '⏰',
        KICK: '👢',
        BAN: '🔨',
        UNBAN: '🔓'
    };
    return emojis[type] || '🛡️';
}

module.exports = { createWarning, createModLogEntry }; 