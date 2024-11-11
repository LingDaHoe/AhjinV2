const { 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder 
} = require('discord.js');
const Appeal = require('../models/Appeal');
const GuildConfig = require('../models/GuildConfig');
const Logger = require('../utils/logger');

class AppealSystem {
    static async handleAppealButton(interaction) {
        try {
            // Check if we can send DMs to the user
            try {
                await interaction.user.send({ content: 'Checking DM permissions...' })
                    .then(msg => msg.delete().catch(() => {}));
            } catch (error) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : Please click the "Enable DM Features" button first to allow the bot to send you messages.'
                    }],
                    ephemeral: true
                });
            }

            const guildId = interaction.customId.split(':')[1];
            console.log('Appeal button clicked. GuildId:', guildId);

            if (!guildId) {
                console.error('No guild ID found in button customId');
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : An error occurred processing your appeal request.'
                    }]
                });
            }

            // Get the guild from the client
            const guild = interaction.client.guilds.cache.get(guildId);
            if (!guild) {
                console.error('Guild not found:', guildId);
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : Unable to find the server.'
                    }]
                });
            }

            // Check if user is actually banned
            try {
                const ban = await guild.bans.fetch(interaction.user.id);
                if (!ban) {
                    return interaction.reply({
                        embeds: [{
                            color: 0x438BEF,
                            description: '> **Ahjin ♱ Protection** : You are not banned from this server.'
                        }]
                    });
                }
            } catch (error) {
                console.error('Error checking ban status:', error);
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : You are not banned from this server.'
                    }]
                });
            }

            // Check for existing appeals
            const existingAppeal = await Appeal.findOne({
                userId: interaction.user.id,
                guildId: guildId,
                status: 'pending'
            });

            if (existingAppeal) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : You already have a pending appeal. Please wait for a response.'
                    }]
                });
            }

            // Check cooldown
            const lastAppeal = await Appeal.findOne({
                userId: interaction.user.id,
                guildId: guildId,
                status: { $in: ['approved', 'denied'] },
                cooldownUntil: { $gt: new Date() }
            });

            if (lastAppeal) {
                const remainingTime = Math.ceil((lastAppeal.cooldownUntil - new Date()) / (1000 * 60 * 60 * 24));
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: `> **Ahjin ♱ Protection** : You must wait ${remainingTime} more days before submitting another appeal.`
                    }]
                });
            }

            // Create the modal
            const modal = new ModalBuilder()
                .setCustomId(`appeal_form:${guildId}`)
                .setTitle('Ban Appeal Form');

            const reasonInput = new TextInputBuilder()
                .setCustomId('appeal_reason')
                .setLabel('Why should your ban be lifted?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000);

            modal.addComponents(
                new ActionRowBuilder().addComponents(reasonInput),
            );

            console.log('Showing modal with customId:', modal.data.custom_id);
            await interaction.showModal(modal);

        } catch (error) {
            console.error('Error in handleAppealButton:', error);
            await this.handleError(interaction);
        }
    }

    static async handleAppealSubmission(interaction) {
        try {
            // Defer the reply immediately
            await interaction.deferReply({ ephemeral: true });
            
            // Get guildId from the customId
            const guildId = interaction.customId.split(':')[1];
            console.log('Processing appeal submission for guild:', guildId);
            
            if (!guildId) {
                console.error('No guild ID found in customId:', interaction.customId);
                return interaction.editReply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : An error occurred while processing your appeal.'
                    }]
                });
            }

            const appealReason = interaction.fields.getTextInputValue('appeal_reason');

            // Get guild configuration
            const guildConfig = await GuildConfig.findOne({ guildId });
            console.log('Found guild config:', guildConfig);

            if (!guildConfig || !guildConfig.appealChannelId) {
                console.log('Config check failed:', {
                    configExists: !!guildConfig,
                    appealChannelId: guildConfig?.appealChannelId
                });
                return interaction.editReply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : Appeals channel not configured. Please contact an administrator.'
                    }]
                });
            }

            console.log('Appeal channel ID:', guildConfig.appealChannelId);
            const appealsChannel = interaction.client.channels.cache.get(guildConfig.appealChannelId);
            
            if (!appealsChannel) {
                console.log('Could not find appeals channel with ID:', guildConfig.appealChannelId);
                return interaction.editReply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : Appeals channel not found. Please contact an administrator.'
                    }]
                });
            }

            // Create appeal embed
            const appealEmbed = {
                color: 0x438BEF,
                description: [
                    '<:appeal:1303234806745923604> Ban Appeal',
                    '',
                    `> This appeal has been submitted by ${interaction.user.tag}`,
                    '',
                    '**Reason for Appeal**',
                    `> <:file:1303248835765600347> : ${appealReason}`,
                    '',
                ].join('\n'),
            };

            // Create approve/deny buttons
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_appeal:${interaction.user.id}:${guildId}`)
                        .setEmoji('<:approved:1303236810511618058>')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`deny_appeal:${interaction.user.id}:${guildId}`)
                        .setEmoji('<:deny:1303236832418598994>')
                        .setStyle(ButtonStyle.Danger)
                );

            // Send to appeals channel
            const appealMessage = await appealsChannel.send({
                embeds: [appealEmbed],
                components: [buttons]
            });

            // Store appeal in database
            await this.storeAppeal({
                userId: interaction.user.id,
                guildId: guildId,
                reason: appealReason,
                messageId: appealMessage.id
            });

            await interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : Your appeal has been submitted successfully. You will be notified of the decision.'
                }]
            });

        } catch (error) {
            console.error('Error handling appeal submission:', error);
            await this.handleError(interaction);
        }
    }

    static async handleAppealDecision(interaction, approved) {
        try {
            // Defer the reply first
            await interaction.deferReply({ ephemeral: true });

            const [, userId, guildId] = interaction.customId.split(':');
            const user = await interaction.client.users.fetch(userId);

            if (approved) {
                try {
                    // Create an invite that never expires
                    const channel = interaction.guild.channels.cache
                        .find(channel => channel.type === 0 && channel.permissionsFor(interaction.guild.members.me).has('CreateInstantInvite'));
                    
                    if (!channel) {
                        console.error('No suitable channel found for creating invite');
                        return interaction.editReply({
                            content: 'Error: Could not create server invite.',
                            ephemeral: true
                        });
                    }

                    const invite = await channel.createInvite({
                        maxAge: 0,
                        maxUses: 1,
                        unique: true,
                        reason: `Ban appeal approved by ${interaction.user.tag}`
                    });

                    await interaction.guild.members.unban(userId, 'Appeal approved');
                    await user.send({
                        embeds: [{
                            color: 0x438BEF,
                            title: '<:approved:1303236810511618058>',
                            description: [
                                `> Your ban appeal for **${interaction.guild.name}** has been approved!`,
                                '',
                                '**Next Steps**',
                                `> Click here to rejoin: ${invite.url}`,
                                '',
                                '**Note**',
                                '> This invite link can only be used once.',
                                '> Please make sure to follow all server rules to avoid future bans.'
                            ].join('\n')
                        }]
                    });

                    await Logger.logModeration(interaction.guild, {
                        moderator: interaction.user,
                        target: user,
                        color: 0x438BEF,
                        description: `> **${user.tag}'s ban appeal has been approved by ${interaction.user.tag}.**`
                    });

                } catch (error) {
                    console.error('Error in appeal approval process:', error);
                    return interaction.editReply({
                        content: `Error processing approval: ${error.message}`,
                        ephemeral: true
                    });
                }
            } else {
                try {
                    await user.send({
                        embeds: [{
                            color: 0x438BEF,
                            title: '<:deny:1303236832418598994>',
                            description: `> Your ban appeal has been denied. You may submit another appeal in 30 days.`,
                        }]
                    });
                } catch (error) {
                    console.error('Error sending denial message:', error);
                }
            }

            // Update appeal status and set cooldown
            await this.updateAppealStatus(userId, guildId, {
                status: approved ? 'approved' : 'denied',
                decidedBy: interaction.user.id,
                decidedAt: new Date(),
                cooldownUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });

            // Disable the buttons
            const row = ActionRowBuilder.from(interaction.message.components[0]);
            row.components.forEach(button => {
                button.setDisabled(true);
            });

            // Update the message with disabled buttons
            await interaction.message.edit({
                components: [row]
            });

            // Use editReply instead of reply
            await interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱ Protection** : Appeal ${approved ? 'approved' : 'denied'} for user ${user.tag}`
                }],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error handling appeal decision:', error);
            await this.handleError(interaction);
        }
    }

    // Database methods
    static async checkRecentAppeal(userId, guildId) {
        return Appeal.findOne({
            userId,
            guildId,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }).sort({ createdAt: -1 });
    }

    static async storeAppeal(appealData) {

        const appeal = new Appeal({
            userId: appealData.userId,
            guildId: appealData.guildId,
            reason: appealData.reason,
            messageId: appealData.messageId,
            status: 'pending' 
        });
        return appeal.save();
    }

    static async updateAppealStatus(userId, guildId, updateData) {
        return Appeal.findOneAndUpdate(
            { userId, guildId, status: 'pending' },
            { $set: updateData },
            { new: true }
        );
    }

    static async handleError(interaction) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : An error occurred processing your request.'
                    }],
                    ephemeral: true
                });
            } else if (interaction.deferred) {
                await interaction.editReply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : An error occurred processing your request.'
                    }]
                });
            }
        } catch (error) {
            console.error('Error handling error response:', error);
        }
    }

    static async removeAppeal(userId, guildId) {
        try {
            const result = await Appeal.findOneAndDelete({
                userId: userId,
                guildId: guildId
            });
            
            if (result) {
                console.log(`Removed appeal for user ${userId} in guild ${guildId}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error removing appeal:', error);
            return false;
        }
    }

    static async removeAllGuildAppeals(guildId) {
        try {
            const result = await Appeal.deleteMany({ guildId: guildId });
            console.log(`Removed ${result.deletedCount} appeals from guild ${guildId}`);
            return result.deletedCount;
        } catch (error) {
            console.error('Error removing guild appeals:', error);
            return 0;
        }
    }

    static async cleanupExpiredAppeals() {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const result = await Appeal.deleteMany({
                status: { $in: ['approved', 'denied'] },
                decidedAt: { $lt: thirtyDaysAgo }
            });
            console.log(`Cleaned up ${result.deletedCount} expired appeals`);
            return result.deletedCount;
        } catch (error) {
            console.error('Error cleaning up expired appeals:', error);
            return 0;
        }
    }

    static async sendBanMessage(user, guild, reason) {
        try {
            const oauthURL = `https://discord.com/oauth2/authorize?client_id=1207377236907401267&permissions=0&scope=applications.commands+bot+dm_channels.messages.write&response_type=code`;
            
            const embed = new EmbedBuilder()
                .setColor(0x438BEF)
                .setTitle('You have been banned')
                .setDescription([
                    `You have been banned from **${guild.name}**`,
                    `\n**Reason:** ${reason || 'No reason provided'}`,
                    '\nTo enable ban appeals via DM, please authorize the bot using the button below.',
                ].join('\n'));

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Enable DM Features')
                        .setURL(oauthURL)
                        .setStyle(ButtonStyle.Link),
                    new ButtonBuilder()
                        .setCustomId(`appeal:${guild.id}`)
                        .setLabel('Appeal Ban')
                        .setStyle(ButtonStyle.Primary)
                );

            await user.send({ embeds: [embed], components: [row] });
            return true;
        } catch (error) {
            console.error('Error sending ban message:', error);
            return false;
        }
    }
}

module.exports = AppealSystem; 