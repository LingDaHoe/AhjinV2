const { PermissionFlagsBits } = require('discord.js');

class Command {
    constructor(options) {
        this.name = options.name;
        this.description = options.description;
        this.category = options.category || 'misc';
        this.cooldown = options.cooldown || 3;
        this.permissions = options.permissions || [];
        this.botPermissions = options.botPermissions || [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ViewChannel
        ];
        this.ownerOnly = options.ownerOnly || false;
        this.disabled = options.disabled || false;
    }

    async hasPermission(interaction) {
        if (this.ownerOnly && interaction.user.id !== process.env.OWNER_ID) {
            return false;
        }

        for (const permission of this.permissions) {
            if (!interaction.member.permissions.has(permission)) {
                return false;
            }
        }

        return true;
    }

    async hasBotPermission(interaction) {
        const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
        
        for (const permission of this.botPermissions) {
            if (!botMember.permissions.has(permission)) {
                return false;
            }
        }

        return true;
    }

    // These methods should be overridden by actual commands
    data() {
        throw new Error(`Command ${this.name} doesn't provide a data method!`);
    }

    async execute(interaction) {
        throw new Error(`Command ${this.name} doesn't provide an execute method!`);
    }
}

module.exports = Command; 