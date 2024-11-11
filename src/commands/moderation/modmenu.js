const { 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    ComponentType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const Command = require('../../structures/Command');
const { createModLogEntry } = require('../../utils/moderation');
const Logger = require('../../utils/logger');
const Warning = require('../../models/Warning');

class ModMenuCommand extends Command {
    constructor() {
        super({
            name: 'modmenu',
            description: 'Open the moderation menu',
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
                    .setName('target')
                    .setDescription('Select a user to moderate')
                    .setRequired(true)
            );
    }

    async execute(interaction) {
        const target = interaction.options.getMember('target');
        
        if (!target) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : User not found.'
                }],
                ephemeral: true
            });
        }

        // Check if target is moderatable
        if (target.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** :You cannot moderate this user as they have equal or higher roles.'
                }],
                ephemeral: true
            });
        }

        // Get user's warning count
        const warningCount = await Warning.countDocuments({
            userId: target.id,
            guildId: interaction.guild.id
        });

        // Create the select menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('mod_action')
            .setPlaceholder('Select a moderation action')
            .addOptions([
                {
                    label: 'Warn',
                    description: 'Issue a warning to the user',
                    value: 'warn',
                    emoji: '<:warn:1303181019800928316>'
                },
                {
                    label: 'Timeout',
                    description: 'Temporarily mute the user',
                    value: 'timeout',
                    emoji: '<:mute:1303181530339872789>'
                },
                {
                    label: 'Kick',
                    description: 'Remove the user from the server',
                    value: 'kick',
                    emoji: '<:kick:1303181809676456087>'
                },
                {
                    label: 'Ban',
                    description: 'Permanently ban the user',
                    value: 'ban',
                    emoji: '<:ban:1303181651576360971>'
                },
                {
                    label: 'View Warnings',
                    description: 'Check user\'s warning history',
                    value: 'warnings',
                    emoji: '<:view:1303181557992914984>'
                },
                {
                    label: 'Unban',
                    description: 'Unban a user from the server',
                    value: 'unban',
                    emoji: '<:unban:1303212611156050051>'
                }
            ]);

        // Create action buttons
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('refresh')
                    .setLabel('Refresh Info')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('close')
                    .setLabel('Close Menu')
                    .setStyle(ButtonStyle.Danger)
            );

        const response = await interaction.reply({
            embeds: [await this.createUserInfoEmbed(target, warningCount, interaction)],
            components: [
                new ActionRowBuilder().addComponents(selectMenu),
                buttons
            ],
            ephemeral: true
        });

        // Create collectors for both select menu and buttons
        const collector = response.createMessageComponentCollector({
            time: 300000 // Menu expires after 5 minutes
        });

        collector.on('collect', async (i) => {
            if (i.customId === 'refresh') {
                const updatedWarningCount = await Warning.countDocuments({
                    userId: target.id,
                    guildId: interaction.guild.id
                });
                await i.update({
                    embeds: [await this.createUserInfoEmbed(target, updatedWarningCount, i)]
                });
                return;
            }

            if (i.customId === 'close') {
                await i.update({
                    components: [],
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : Moderation menu closed.'
                    }]
                });
                collector.stop();
                return;
            }

            if (i.customId === 'mod_action') {
                const action = i.values[0];
                switch (action) {
                    case 'warn':
                        await this.handleWarnAction(i, target);
                        break;
                    case 'timeout':
                        await this.handleTimeoutAction(i, target);
                        break;
                    case 'kick':
                        await this.handleKickAction(i, target);
                        break;
                    case 'ban':
                        await this.handleBanAction(i, target);
                        break;
                    case 'warnings':
                        await this.handleWarningsAction(i, target);
                        break;
                }
            }
        });

        collector.on('end', () => {
            if (interaction.replied || interaction.deferred) {
                interaction.editReply({
                    components: [],
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : Moderation menu expired.'
                    }]
                }).catch(() => {});
            }
        });
    }

    async createUserInfoEmbed(target, warningCount, interaction) {
        const roles = target.roles.cache
            .filter(role => role.id !== target.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .slice(0, 10);

        return {
            color: target.displayColor || 0x438BEF,
            title: 'Moderation Menu  <:badge1:1303076755665584258>  ',
            description: `> Select an action to perform on ${target}`,
            fields: [
                {
                    name: 'User Information  <:information:1303073707518070885> ',
                    value: [
`\`\`\`
Username: ${target.user.tag}
ID: ${target.id}
Warnings: ${warningCount}
\`\`\``
                    ].join('\n'),
                    inline: true
                },
                {
                    name: 'Roles <:roles1:1303081472542117889> ',
                    value: roles.length ? roles.join(', ') : 'No roles',
                    inline: false
                }
            ],
            footer: {
                text: `Moderator: ${interaction.user.tag}`
            }
        };
    }

    async handleWarnAction(interaction, target) {
        const modal = new ModalBuilder()
            .setCustomId(`warn_modal_${target.id}`)
            .setTitle('Issue Warning');

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for warning')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter the reason for the warning')
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);

        try {
            const modalResponse = await interaction.awaitModalSubmit({
                time: 300000,
                filter: i => i.customId === `warn_modal_${target.id}`
            });

            const reason = modalResponse.fields.getTextInputValue('reason');

            // Create warning in database
            const warning = new Warning({
                userId: target.id,
                guildId: interaction.guild.id,
                moderatorId: interaction.user.id,
                reason: reason,
                timestamp: new Date()
            });

            await warning.save();

            // Create mod log entry
            await createModLogEntry(interaction.guild, {
                type: 'WARN',
                target: target.user,
                moderator: interaction.user,
                reason: reason
            });

            // Log using the Logger utility
            await Logger.logModeration(interaction.guild, {
                moderator: interaction.user,
                target: target.user,
                color: 0x438BEF,
                description: `> **${target.user.tag} has been warned for ${reason}.** `
            });

            await modalResponse.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱ Protection** : Successfully warned ${target.user.tag}. `,
                }],
                ephemeral: true
            });

        } catch (error) {
            console.error('Warning modal error:', error);
        }
    }

    async handleTimeoutAction(interaction, target) {
        const modal = new ModalBuilder()
            .setCustomId(`timeout_modal_${target.id}`)
            .setTitle('Timeout User');

        const durationInput = new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Duration (in minutes)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter duration (1-40320)')
            .setRequired(true)
            .setMaxLength(5);

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for timeout')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter the reason for the timeout')
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(reasonInput)
        );

        await interaction.showModal(modal);

        try {
            const modalResponse = await interaction.awaitModalSubmit({
                time: 300000,
                filter: i => i.customId === `timeout_modal_${target.id}`
            });

            const duration = parseInt(modalResponse.fields.getTextInputValue('duration'));
            const reason = modalResponse.fields.getTextInputValue('reason');

            if (isNaN(duration) || duration < 1 || duration > 40320) {
                return modalResponse.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : Invalid duration. Please enter a number between 1 and 40320 minutes.'
                    }],
                    ephemeral: true
                });
            }

            await target.timeout(duration * 60 * 1000, reason);

            // Create mod log entry
            await createModLogEntry(interaction.guild, {
                type: 'TIMEOUT',
                target: target.user,
                moderator: interaction.user,
                reason: reason,
                duration: `${duration} minutes`
            });

            // Log using the Logger utility
            await Logger.logModeration(interaction.guild, {
                moderator: interaction.user,
                target: target.user,
                color: 0x438BEF,
                description: `> **${target.user.tag} has been timed out for ${reason}.** `
            });

            await modalResponse.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱ Protection** : Successfully timed out ${target.user.tag}. `,
                }],
                ephemeral: true
            });

        } catch (error) {
            console.error('Timeout modal error:', error);
        }
    }

    async handleKickAction(interaction, target) {
        try {
            // Defer the reply immediately when the modal is submitted
            await interaction.deferReply({ ephemeral: true });
            
            const reason = interaction.fields.getTextInputValue('kickReason');
            
            await target.kick(reason);
            
            await ModerationLogger.logModAction(interaction.guild, {
                type: 'KICK',
                moderator: interaction.user,
                target: target,
                reason: reason
            });

            // Use editReply instead of reply since we deferred
            await interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱ Protection** : Successfully kicked ${target.user.tag}.`
                }]
            });
            
        } catch (error) {
            // Use editReply for error handling too
            await interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱ Protection** : Failed to kick user: ${error.message}`
                }]
            });
        }
    }

    async handleBanAction(interaction, target) {
        const modal = new ModalBuilder()
            .setCustomId(`ban_modal_${target.id}`)
            .setTitle('Ban User');

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for ban')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter the reason for banning the user')
            .setRequired(true)
            .setMaxLength(1000);

        const deleteDaysInput = new TextInputBuilder()
            .setCustomId('delete_days')
            .setLabel('Days of messages to delete (0-7)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter number of days')
            .setRequired(true)
            .setMaxLength(1);

        modal.addComponents(
            new ActionRowBuilder().addComponents(reasonInput),
            new ActionRowBuilder().addComponents(deleteDaysInput)
        );

        await interaction.showModal(modal);

        try {
            const modalResponse = await interaction.awaitModalSubmit({
                time: 300000,
                filter: i => i.customId === `ban_modal_${target.id}`
            });

            const reason = modalResponse.fields.getTextInputValue('reason');
            const deleteDays = parseInt(modalResponse.fields.getTextInputValue('delete_days'));

            
            try {
                const appealButton = new ButtonBuilder()
                    .setCustomId(`create_appeal:${interaction.guild.id}`)
                    .setLabel('Ban Appeal')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('<:appeal:1303234806745923604>');

                const oauthURL = `https://discord.com/oauth2/authorize?client_id=1207377236907401267&response_type=code&redirect_uri=https%3A%2F%2Fdiscord.com%2Foauth2%2Fauthorize%3Fclient_id%3D1207377236907401267&scope=dm_channels.messages.write`;

                console.log('Creating appeal button with customId:', `create_appeal:${interaction.guild.id}`);

                const dmEmbed = {
                    color: 0x438BEF,
                    description: [
                        '> **Boo! You just got banned!**',
                        `> You have been banned from **${interaction.guild.name}** for **${reason}**.`,
                        '',
                        '**How to appeal?**',
                        '> 1. Click "Enable DM Features" first to allow appeals',
                        '> 2. Then click "Ban Appeal" to submit your appeal',
                        '',
                        '**Note:**',
                        ' <:dot:1303231480285106186> You can only submit one appeal every 30 days\n',
                        ' <:dot:1303231480285106186> Appeals should be respectful and honest\n',
                        ' <:dot:1303231480285106186> Include any relevant information or context\n',
                        '',
                        '> Kindly make sure that all the information you provide for your reason is truthful. \n',
                    ].join('\n')
                };

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Enable DM Features')
                            .setURL(oauthURL)
                            .setStyle(ButtonStyle.Link),
                        appealButton
                    );

                await target.send({
                    embeds: [dmEmbed],
                    components: [row]
                });
                console.log('Successfully sent ban DM with appeal button');
            } catch (dmError) {
                console.error('Failed to send DM:', dmError);
            }

            // Proceed with ban
            await target.ban({ deleteMessageDays: deleteDays, reason: reason });

            // Create mod log entry
            await createModLogEntry(interaction.guild, {
                type: 'BAN',
                target: target.user,
                moderator: interaction.user,
                reason: reason,
                additionalInfo: `Messages deleted: ${deleteDays} days`
            });

            // Log using the Logger utility
            await Logger.logModeration(interaction.guild, {
                moderator: interaction.user,
                target: target.user,
                color: 0x438BEF,
                description: `> **${target.user.tag} has been banned from the server for ${reason}.** `
            });

            await modalResponse.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱ Protection** : Successfully banned ${target.user.tag}. `,
                }],
                ephemeral: true
            });

        } catch (error) {
            console.error('Ban modal error:', error);
            if (modalResponse) {
                await modalResponse.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** :Failed to ban user.'
                    }],
                    ephemeral: true
                });
            }
        }
    }

    async handleWarningsAction(interaction, target) {
        try {
            const warnings = await Warning.find({
                userId: target.id,
                guildId: interaction.guild.id
            }).sort({ timestamp: -1 });

            if (warnings.length === 0) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: `> **Ahjin ♱ Protection** : ${target.user.tag} has no warnings.`
                    }],
                    ephemeral: true
                });
            }

            const warningList = warnings.map((warn, index) => {
                const date = new Date(warn.timestamp).toLocaleDateString();
                const moderator = interaction.guild.members.cache.get(warn.moderatorId);
                return `**${index + 1}.** \`${date}\` by ${moderator ? moderator : 'Unknown Moderator'}\n└ Reason: ${warn.reason}`;
            }).join('\n\n');

            const embed = {
                color: 0x438BEF,
                description: `> Warning History for ${target.user.tag}\n\n${warningList}`,
                footer: {
                    text: `Total Warnings: ${warnings.length}`
                }
            };

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error('Error fetching warnings:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : Failed to fetch warnings.'
                }],
                ephemeral: true
            });
        }
    }
}

module.exports = ModMenuCommand; 