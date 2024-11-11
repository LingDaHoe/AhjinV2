const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Command = require('../../structures/Command');
const ModerationLogger = require('../../utils/moderationLogger');

class MuteCommand extends Command {
    constructor() {
        super({
            name: 'mute',
            description: 'Mute a member',
            category: 'moderation',
            userPermissions: [PermissionFlagsBits.ModerateMembers]
        });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription('The user to mute')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('reason')
                    .setDescription('The reason for the mute')
                    .setRequired(false)
            )
            .addIntegerOption(option =>
                option
                    .setName('duration')
                    .setDescription('Duration in minutes')
                    .setRequired(false)
            );
    }

    async execute(interaction) {
        const target = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const duration = interaction.options.getInteger('duration') || 60; // Default 60 minutes

        if (!target) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** :Could not find that user'
                }],
                ephemeral: true
            });
        }

        try {
            await target.timeout(duration * 60 * 1000, reason);

            await ModerationLogger.logMute(interaction.guild, {
                moderator: interaction.user,
                target: target.user,
                duration: duration,
                reason: reason
            });

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱ Protection** : Successfully muted ${target.user.tag}. `
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Mute error:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : Failed to mute user. '
                }],
                ephemeral: true
            });
        }
    }
}

module.exports = MuteCommand; 