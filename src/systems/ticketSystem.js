const { 
    PermissionFlagsBits, 
    ButtonBuilder, 
    ActionRowBuilder, 
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const GuildSettings = require('../models/GuildSettings');

class TicketSystem {
    static async handleTicketCreate(interaction) {
        try {
            const guildSettings = await GuildSettings.findOne({ guildId: interaction.guildId });
            console.log('Guild Settings:', {
                exists: !!guildSettings,
                ticketChannelId: guildSettings?.ticketChannelId,
                supportRoleId: guildSettings?.ticketConfig?.supportRoleId,
                managerRoleId: guildSettings?.ticketConfig?.managerRoleId,
                guildId: interaction.guildId
            });

            if (!guildSettings || !guildSettings.ticketChannelId || !guildSettings.ticketConfig?.supportRoleId) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : Ticket system is not fully configured.' +
                            `\n> Channel: ${guildSettings?.ticketChannelId ? '✅' : '��'}` +
                            `\n> Support Role: ${guildSettings?.ticketConfig?.supportRoleId ? '✅' : '❌'}`
                    }],
                    ephemeral: true
                });
            }

            // Create ticket channel with updated permissions
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`,
                type: 0,
                parent: interaction.channel.parent,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: guildSettings.ticketConfig.supportRoleId,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });

            // Create ticket embed
            const ticketEmbed = new EmbedBuilder()
                .setColor(0x438BEF)
                .setDescription([
                    '> **Ticket Support**',
                    '',
                    '> Please describe your issue and wait for a staff member to assist you.',
                    '',
                    '**Note:**',
                    '> • Be patient while waiting for assistance',
                    '> • Provide clear details about your issue',
                    '> • Respect staff members and follow server rules'
                ].join('\n'));

                const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('Close Ticket')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('download_transcript')
                        .setLabel('Save Transcript')
                        .setEmoji('📥')
                        .setStyle(ButtonStyle.Secondary)
                );

            await ticketChannel.send({
                content: `${interaction.user} Welcome to your ticket! Support team: <@&${guildSettings.ticketConfig.supportRoleId}>`,
                embeds: [ticketEmbed],
                components: [buttons]
            });

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱ Protection** : Ticket created! Check ${ticketChannel}`
                }],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error creating ticket:', error);
            await this.handleError(interaction);
        }
    }

static async handleTicketClose(interaction) {
    try {
        const guildSettings = await GuildSettings.findOne({ guildId: interaction.guildId });
        const hasPermission = interaction.member.roles.cache.has(guildSettings.ticketConfig.supportRoleId) || 
                            interaction.member.roles.cache.has(guildSettings.ticketConfig.managerRoleId);
        
        if (!hasPermission) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : You do not have permission to close tickets.'
                }],
                ephemeral: true
            });
        }

        await interaction.channel.delete();

    } catch (error) {
        console.error('Error closing ticket:', error);
        await this.handleError(interaction);
    }
}

    static async handleTicketTranscript(interaction, isClosing = false) {
        try {
            const guildSettings = await GuildSettings.findOne({ guildId: interaction.guildId });
            const hasPermission = interaction.member.roles.cache.has(guildSettings.ticketConfig.supportRoleId) || 
                                interaction.member.roles.cache.has(guildSettings.ticketConfig.managerRoleId);
            
            if (!hasPermission) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : You do not have permission to save transcripts.'
                    }],
                    ephemeral: true
                });
            }

            if (!guildSettings.ticketLogChannelId) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : Ticket log channel is not configured.'
                    }],
                    ephemeral: true
                });
            }

            const logChannel = await interaction.guild.channels.fetch(guildSettings.ticketLogChannelId);
            const messages = await interaction.channel.messages.fetch();
            let transcript = `Ticket Transcript - ${interaction.channel.name}\n\n`;

            messages.reverse().forEach(msg => {
                transcript += `${msg.author.tag} (${msg.createdAt.toLocaleString()}): ${msg.content}\n`;
            });

            const buffer = Buffer.from(transcript, 'utf-8');
            await logChannel.send({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ticket Transcript** : ${interaction.channel.name}\n> **Saved by** : ${interaction.user.tag}`
                }],
                files: [{
                    attachment: buffer,
                    name: `transcript-${interaction.channel.name}.txt`
                }]
            });

            if (!isClosing) {
                await interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱ Protection** : Transcript has been saved to the logs channel.'
                    }],
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Error creating transcript:', error);
            await this.handleError(interaction);
        }
    }

    static async handleError(interaction) {
        try {
            const reply = {
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : An error occurred while processing your request.'
                }],
                ephemeral: true
            };

            if (interaction.deferred) {
                await interaction.editReply(reply);
            } else if (!interaction.replied) {
                await interaction.reply(reply);
            }
        } catch (error) {
            console.error('Error handling error response:', error);
        }
    }
}

module.exports = TicketSystem; 