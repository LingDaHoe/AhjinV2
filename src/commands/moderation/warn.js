const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Command = require('../../structures/Command');
const Warning = require('../../models/Warning');
const ModerationLogger = require('../../utils/moderationLogger');

class WarnCommand extends Command {
    constructor() {
        super({
            name: 'warn',
            description: 'Warn a user',
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
                    .setDescription('The user to warn')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('reason')
                    .setDescription('Reason for the warning')
                    .setRequired(true)
            );
    }

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        try {
            const warning = new Warning({
                userId: target.id,
                guildId: interaction.guild.id,
                moderatorId: interaction.user.id,
                reason: reason,
                timestamp: new Date()
            });

            await warning.save();

            const totalWarnings = await Warning.countDocuments({
                userId: target.id,
                guildId: interaction.guild.id
            });

            await ModerationLogger.logWarning(interaction.guild, {
                moderator: interaction.user,
                target: target,
                reason: reason,
                totalWarnings: totalWarnings
            });

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱ Protection** : Successfully warned ${target.tag}. `,
                }],
                ephemeral: true
            });

        } catch (error) {
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : Failed to warn user: ' + error.message
                }],
                ephemeral: true
            });
        }
    }
}

module.exports = WarnCommand; 