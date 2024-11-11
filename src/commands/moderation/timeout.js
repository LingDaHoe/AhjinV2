const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Command = require('../../structures/Command');
const ModerationLogger = require('../../utils/moderationLogger');

class TimeoutCommand extends Command {
    constructor() {
        super({
            name: 'timeout',
            description: 'Timeout a user',
            category: 'moderation',
            permissions: [PermissionFlagsBits.ModerateMembers],
        });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription('The user to timeout')
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option
                    .setName('duration')
                    .setDescription('Timeout duration in minutes')
                    .setMinValue(1)
                    .setMaxValue(40320) // 4 weeks
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('reason')
                    .setDescription('Reason for the timeout')
                    .setRequired(false)
            );
    }

    async execute(interaction) {
        const target = interaction.options.getMember('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!target) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : User not found.'
                }],
                ephemeral: true
            });
        }

        if (!target.moderatable) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : I cannot moderate that user.'
                }],
                ephemeral: true
            });
        }

        try {
            await target.timeout(duration * 60 * 1000, reason);

            await ModerationLogger.logTimeout(interaction.guild, {
                moderator: interaction.user,
                target: target.user,
                duration: duration,
                reason: reason
            });

            await interaction.reply({
                embeds: [{
                    color: 0x2C2F33,
                    description: `> **Ahjin ♱ Protection** : Successfully timed out ${target.user.tag}. `
                }],
                ephemeral: true
            });

        } catch (error) {
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : Failed to timeout user: ' + error.message
                }],
                ephemeral: true
            });
        }
    }
}

module.exports = TimeoutCommand; 