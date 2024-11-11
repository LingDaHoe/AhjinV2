const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Command = require('../../structures/Command');
const GuildSettings = require('../../models/GuildSettings');

class SetTicketCommand extends Command {
    constructor() {
        super({
            name: 'setticket',
            description: 'Configure the ticket system',
            category: 'admin',
            userPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('channel')
                    .setDescription('Set the ticket creation channel')
                    .addChannelOption(option =>
                        option
                            .setName('channel')
                            .setDescription('The channel where users can create tickets')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('logs')
                    .setDescription('Set the ticket logs channel')
                    .addChannelOption(option =>
                        option
                            .setName('channel')
                            .setDescription('The channel where ticket logs will be sent')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('roles')
                    .setDescription('Configure ticket support roles')
                    .addRoleOption(option =>
                        option
                            .setName('support')
                            .setDescription('Role that can view and reply to tickets')
                            .setRequired(true)
                    )
                    .addRoleOption(option =>
                        option
                            .setName('manager')
                            .setDescription('Role that can close and download tickets')
                            .setRequired(true)
                    )
            );
    }

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'channel':
                    await this.handleChannel(interaction);
                    break;
                case 'logs':
                    await this.handleLogs(interaction);
                    break;
                case 'roles':
                    await this.handleRoles(interaction);
                    break;
            }
        } catch (error) {
            console.error(`Error in ${subcommand}:`, error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : An error occurred while configuring the ticket system.'
                }],
                ephemeral: true
            });
        }
    }

    async handleChannel(interaction) {
        const channel = interaction.options.getChannel('channel');
        
        await GuildSettings.findOneAndUpdate(
            { guildId: interaction.guildId },
            { 
                $set: {
                    ticketChannelId: channel.id
                }
            },
            { upsert: true }
        );

        const ticketEmbed = {
            color: 0x438BEF,
            description: '> If you encounter any issues or problems, click on 📩 to create a ticket!'
        };

        const ticketButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Create Ticket')
                    .setEmoji('📩')
                    .setStyle(ButtonStyle.Primary)
            );

        await channel.send({
            embeds: [ticketEmbed],
            components: [ticketButton]
        });

        await interaction.reply({
            embeds: [{
                color: 0x438BEF,
                description: `> **Ahjin ♱ Protection** : Successfully set ticket channel to ${channel}`
            }],
            ephemeral: true
        });
    }

    async handleLogs(interaction) {
        const channel = interaction.options.getChannel('channel');
        
        await GuildSettings.findOneAndUpdate(
            { guildId: interaction.guildId },
            { 
                $set: {
                    ticketLogChannelId: channel.id
                }
            },
            { upsert: true }
        );

        await interaction.reply({
            embeds: [{
                color: 0x438BEF,
                description: `> **Ahjin ♱ Protection** : Successfully set ticket logs channel to ${channel}`
            }],
            ephemeral: true
        });
    }

    async handleRoles(interaction) {
        const supportRole = interaction.options.getRole('support');
        const managerRole = interaction.options.getRole('manager');
        
        try {
            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { 
                    $set: { 
                        'ticketConfig.supportRoleId': supportRole.id,
                        'ticketConfig.managerRoleId': managerRole.id
                    }
                },
                { upsert: true, new: true }
            );

            // Verify the update
            const verifySettings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            console.log('Verified settings:', {
                guildId: verifySettings.guildId,
                supportRole: verifySettings.ticketConfig?.supportRoleId,
                managerRole: verifySettings.ticketConfig?.managerRoleId
            });

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: [
                        '> **Ahjin ♱ Protection** : Successfully configured ticket roles:',
                        `> Support Role: ${supportRole}`,
                        `> Manager Role: ${managerRole}`
                    ].join('\n')
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error setting roles:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : Failed to configure ticket roles'
                }],
                ephemeral: true
            });
        }
    }
}

module.exports = SetTicketCommand; 