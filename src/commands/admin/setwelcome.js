const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const GuildSettings = require('../../models/GuildSettings');

class SetWelcomeCommand extends Command {
    constructor() {
        super({
            name: 'setwelcome',
            description: 'Configure the welcome system',
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
                    .setDescription('Set the welcome channel')
                    .addChannelOption(option =>
                        option
                            .setName('channel')
                            .setDescription('The channel for welcome messages')
                            .addChannelTypes(ChannelType.GuildText)
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('config')
                    .setDescription('Configure welcome message settings')
                    .addStringOption(option =>
                        option
                            .setName('title')
                            .setDescription('Set the welcome message title')
                            .setRequired(false)
                    )
                    .addStringOption(option =>
                        option
                            .setName('description')
                            .setDescription('Set the welcome message description')
                            .setRequired(false)
                    )
                    .addStringOption(option =>
                        option
                            .setName('banner')
                            .setDescription('Set the welcome banner URL')
                            .setRequired(false)
                    )
                    .addStringOption(option =>
                        option
                            .setName('color')
                            .setDescription('Set the embed color (hex format: #FF0000)')
                            .setRequired(false)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('toggle')
                    .setDescription('Toggle the welcome system')
                    .addBooleanOption(option =>
                        option
                            .setName('enabled')
                            .setDescription('Enable or disable welcome messages')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('preview')
                    .setDescription('Preview the current welcome message')
            );
    }

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'channel':
                await this.handleChannel(interaction);
                break;
            case 'config':
                await this.handleConfig(interaction);
                break;
            case 'toggle':
                await this.handleToggle(interaction);
                break;
            case 'preview':
                await this.handlePreview(interaction);
                break;
        }
    }

    async handleChannel(interaction) {
        const channel = interaction.options.getChannel('channel');

        try {
            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { 
                    welcomeChannel: channel.id,
                    'welcomeConfig.enabled': true
                },
                { upsert: true }
            );

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : Welcome channel has been set to ${channel}`
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error setting welcome channel:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to set welcome channel'
                }],
                ephemeral: true
            });
        }
    }

    async handleConfig(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const banner = interaction.options.getString('banner');
        const color = interaction.options.getString('color');

        try {
            const updateData = {};
            if (title) updateData['welcomeConfig.title'] = title;
            if (description) updateData['welcomeConfig.description'] = description;
            if (banner) updateData['welcomeConfig.bannerUrl'] = banner;
            if (color) {
                const colorNum = parseInt(color.replace('#', ''), 16);
                updateData['welcomeConfig.color'] = colorNum;
            }

            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { $set: updateData },
                { upsert: true }
            );

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Welcome message configuration updated'
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error updating welcome config:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to update welcome configuration'
                }],
                ephemeral: true
            });
        }
    }

    async handleToggle(interaction) {
        const enabled = interaction.options.getBoolean('enabled');

        try {
            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { 'welcomeConfig.enabled': enabled },
                { upsert: true }
            );

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : Welcome system has been ${enabled ? 'enabled' : 'disabled'}`
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error toggling welcome system:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to toggle welcome system'
                }],
                ephemeral: true
            });
        }
    }

    async handlePreview(interaction) {
        try {
            const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            if (!settings?.welcomeConfig) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱** : Welcome system is not configured'
                    }],
                    ephemeral: true
                });
            }

            const welcomeEmbed = new EmbedBuilder()
                .setColor(settings.welcomeConfig.color || 0x438BEF)
                .setTitle(settings.welcomeConfig.title)
                .setDescription(settings.welcomeConfig.description.replace('{user}', interaction.user.toString()))
                .setTimestamp();

            if (settings.welcomeConfig.bannerUrl) {
                welcomeEmbed.setImage(settings.welcomeConfig.bannerUrl);
            }

            await interaction.reply({
                embeds: [welcomeEmbed],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error previewing welcome message:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to preview welcome message'
                }],
                ephemeral: true
            });
        }
    }
}

module.exports = SetWelcomeCommand; 