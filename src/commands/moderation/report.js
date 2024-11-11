const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Command = require('../../structures/Command');
const ModerationLogger = require('../../utils/moderationLogger');

class ReportCommand extends Command {
    constructor() {
        super({
            name: 'report',
            description: 'Report a user for breaking rules',
            category: 'moderation',
            cooldown: 60, // 1 minute cooldown to prevent spam
        });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription('The user to report')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName('reason')
                    .setDescription('Reason for the report')
                    .setRequired(true)
                    .setMaxLength(1000)
            )
            .addStringOption(option =>
                option
                    .setName('evidence')
                    .setDescription('Any evidence (message links, screenshots, etc.)')
                    .setRequired(false)
            );
    }

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const evidence = interaction.options.getString('evidence') || 'No evidence provided';

        // Find or create reports channel
        let reportsChannel = interaction.guild.channels.cache.find(
            channel => channel.name === 'reports'
        );

        if (!reportsChannel) {
            try {
                reportsChannel = await interaction.guild.channels.create({
                    name: 'reports',
                    type: 0, // GUILD_TEXT
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        },
                        {
                            id: interaction.guild.roles.cache.find(r => r.name === 'Moderator')?.id,
                            allow: [PermissionFlagsBits.ViewChannel]
                        }
                    ]
                });
            } catch (error) {
                return interaction.reply({
                    content: 'Could not create reports channel. Please contact an administrator.',
                    ephemeral: true
                });
            }
        }

        try {
            // Send report to reports channel
            await reportsChannel.send({
                embeds: [{
                    color: 0x2C2F33,
                    title: '🚨 New Report',
                    fields: [
                        {
                            name: 'Reported User',
                            value: `${target} (${target.tag})`
                        },
                        {
                            name: 'Reported By',
                            value: `${interaction.user} (${interaction.user.tag})`
                        },
                        {
                            name: 'Reason',
                            value: reason
                        },
                        {
                            name: 'Evidence',
                            value: evidence
                        },
                        {
                            name: 'Channel',
                            value: `${interaction.channel}`
                        }
                    ],
                    timestamp: new Date()
                }]
            });

            // Log the report
            await ModerationLogger.logReport(interaction.guild, {
                moderator: interaction.user,
                target: target,
                reason: reason,
                evidence: evidence,
                channel: interaction.channel
            });

            // Confirm to user
            await interaction.reply({
                embeds: [{
                    color: 0x2C2F33,
                    description: '✅ Your report has been submitted to the moderators.',
                    footer: { text: 'Thank you for helping keep the server safe!' }
                }],
                ephemeral: true
            });

        } catch (error) {
            await interaction.reply({
                embeds: [{
                    color: 0x2C2F33,
                    description: '❌ Failed to submit report: ' + error.message
                }],
                ephemeral: true
            });
        }
    }
}

module.exports = ReportCommand; 