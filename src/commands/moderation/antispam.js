const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Command = require('../../structures/Command');

class AntispamCommand extends Command {
    constructor() {
        super({
            name: 'antispam',
            description: 'Manage anti-spam settings',
            category: 'moderation',
            permissions: [PermissionFlagsBits.Administrator],
        });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('enable')
                    .setDescription('Enable anti-spam system')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('disable')
                    .setDescription('Disable anti-spam system')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('settings')
                    .setDescription('Configure anti-spam settings')
                    .addIntegerOption(option =>
                        option
                            .setName('message_threshold')
                            .setDescription('Number of messages before trigger (default: 5)')
                            .setMinValue(3)
                            .setMaxValue(10)
                    )
                    .addIntegerOption(option =>
                        option
                            .setName('time_window')
                            .setDescription('Time window in seconds (default: 5)')
                            .setMinValue(3)
                            .setMaxValue(30)
                    )
                    .addIntegerOption(option =>
                        option
                            .setName('timeout_duration')
                            .setDescription('Timeout duration in minutes (default: 5)')
                            .setMinValue(1)
                            .setMaxValue(60)
                    )
                    .addIntegerOption(option =>
                        option
                            .setName('warn_threshold')
                            .setDescription('Warnings before timeout (default: 2)')
                            .setMinValue(1)
                            .setMaxValue(5)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('status')
                    .setDescription('Check current anti-spam settings')
            );
    }

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const spamManager = interaction.client.spamManager;

        switch (subcommand) {
            case 'enable':
                await this.handleEnable(interaction, spamManager);
                break;
            case 'disable':
                await this.handleDisable(interaction, spamManager);
                break;
            case 'settings':
                await this.handleSettings(interaction, spamManager);
                break;
            case 'status':
                await this.handleStatus(interaction, spamManager);
                break;
        }
    }

    async handleEnable(interaction, spamManager) {
        spamManager.enabledGuilds.add(interaction.guild.id);
        await interaction.reply({
            embeds: [{
                color: 0x00ff00,
                title: '✅ Anti-Spam Enabled',
                description: 'The anti-spam system has been enabled for this server.',
                timestamp: new Date()
            }],
            ephemeral: true
        });
    }

    async handleDisable(interaction, spamManager) {
        spamManager.enabledGuilds.delete(interaction.guild.id);
        await interaction.reply({
            embeds: [{
                color: 0xff0000,
                title: '🚫 Anti-Spam Disabled',
                description: 'The anti-spam system has been disabled for this server.',
                timestamp: new Date()
            }],
            ephemeral: true
        });
    }

    async handleSettings(interaction, spamManager) {
        const messageThreshold = interaction.options.getInteger('message_threshold');
        const timeWindow = interaction.options.getInteger('time_window');
        const timeoutDuration = interaction.options.getInteger('timeout_duration');
        const warnThreshold = interaction.options.getInteger('warn_threshold');

        const guildConfig = spamManager.config;

        if (messageThreshold) guildConfig.messageThreshold = messageThreshold;
        if (timeWindow) guildConfig.timeWindow = timeWindow * 1000;
        if (timeoutDuration) guildConfig.timeoutDuration = timeoutDuration * 60000;
        if (warnThreshold) guildConfig.warnThreshold = warnThreshold;

        await interaction.reply({
            embeds: [{
                color: 0x00ff00,
                title: '⚙️ Anti-Spam Settings Updated',
                fields: [
                    {
                        name: 'Message Threshold',
                        value: `${guildConfig.messageThreshold} messages`,
                        inline: true
                    },
                    {
                        name: 'Time Window',
                        value: `${guildConfig.timeWindow / 1000} seconds`,
                        inline: true
                    },
                    {
                        name: 'Timeout Duration',
                        value: `${guildConfig.timeoutDuration / 60000} minutes`,
                        inline: true
                    },
                    {
                        name: 'Warn Threshold',
                        value: `${guildConfig.warnThreshold} warnings`,
                        inline: true
                    }
                ],
                timestamp: new Date()
            }],
            ephemeral: true
        });
    }

    async handleStatus(interaction, spamManager) {
        const isEnabled = spamManager.enabledGuilds.has(interaction.guild.id);
        const config = spamManager.config;

        await interaction.reply({
            embeds: [{
                color: isEnabled ? 0x00ff00 : 0xff0000,
                title: '📊 Anti-Spam Status',
                description: `Status: ${isEnabled ? '✅ Enabled' : '❌ Disabled'}`,
                fields: [
                    {
                        name: 'Message Threshold',
                        value: `${config.messageThreshold} messages`,
                        inline: true
                    },
                    {
                        name: 'Time Window',
                        value: `${config.timeWindow / 1000} seconds`,
                        inline: true
                    },
                    {
                        name: 'Timeout Duration',
                        value: `${config.timeoutDuration / 60000} minutes`,
                        inline: true
                    },
                    {
                        name: 'Warn Threshold',
                        value: `${config.warnThreshold} warnings`,
                        inline: true
                    }
                ],
                timestamp: new Date()
            }],
            ephemeral: true
        });
    }
}

module.exports = AntispamCommand; 