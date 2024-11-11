const Logger = require('./logger');

class ModerationLogger {
    static getUserTag(user) {
        return user?.tag || user?.user?.tag || user?.username || user?.user?.username || 'Unknown User';
    }

    static async logWarning(guild, { moderator, target, reason, totalWarnings }) {
        return Logger.logModeration(guild, {
            moderator,
            target,
            reason,
            color: 0x438BEF,
            description: `> **${this.getUserTag(target)} has been warned for ${reason}.** `
        });
    }

    static async logTimeout(guild, { moderator, target, duration, reason }) {
        return Logger.logModeration(guild, {
            moderator,
            target,
            reason,
            color: 0x438BEF,
            description: `> **${this.getUserTag(target)} has been timed out for ${reason}.** `
        });
    }

    static async logMute(guild, { moderator, target, duration, reason }) {
        return Logger.logModeration(guild, {
            moderator,
            target,
            reason,
            color: 0x438BEF,
            description: `> **${this.getUserTag(target)} has been muted for ${reason}.** `
        });
    }

    static async logReport(guild, { moderator, target, reason, evidence, channel }) {
        return Logger.logModeration(guild, {
            moderator,
            target,
            color: 0x438BEF,
            description: `> **Ahjin ♱ Protection** : ${this.getUserTag(target)} has been reported.`,
            fields: [
                { name: '👤 Reporter', value: this.getUserTag(moderator), inline: true },
                { name: '📝 Reason', value: reason },
                { name: '📄 Evidence', value: evidence || 'No evidence provided' },
                { name: '📌 Channel', value: channel.toString() }
            ]
        });
    }

    static async logModAction(guild, { type, moderator, target, reason, duration, additionalInfo }) {
        const logConfigs = {
            WARN: {
                color: 0x438BEF,
                title: 'Warning Issued'
            },
            TIMEOUT: {
                color: 0x438BEF,
                title: 'Member Timed Out'
            },
            KICK: {
                color: 0x438BEF,
                title: 'Member Kicked'
            },
            BAN: {
                color: 0x438BEF,
                title: 'Member Banned'
            },
            WARNING_CHECK: {
                color: 0x438BEF,
                title: 'Warnings Checked'
            }
        };

        const config = logConfigs[type];
        const fields = [
            { name: '👤 Moderator', value: this.getUserTag(moderator), inline: true }
        ];

        if (duration) {
            fields.push({ name: '⏱️ Duration', value: duration, inline: true });
        }
        if (reason) {
            fields.push({ name: '📝 Reason', value: reason });
        }
        if (additionalInfo) {
            fields.push({ name: '📌 Additional Info', value: additionalInfo });
        }

        return Logger.logModeration(guild, {
            moderator,
            target,
            color: config.color,
            description: `> **Ahjin ♱ Protection** : ${this.getUserTag(target)} has been ${type.toLowerCase()}.`,
            fields
        });
    }

    static async logUnban(guild, { moderator, target, reason }) {
        return Logger.logModeration(guild, {
            moderator,
            target,
            reason,
            color: 0x438BEF,
            description: `> **${target.tag || target.user?.tag} has been unbanned for ${reason}.** `
        });
    }
}

module.exports = ModerationLogger; 