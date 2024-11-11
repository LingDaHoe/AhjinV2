const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Command = require('../../structures/Command');
const GuildSettings = require('../../models/GuildSettings');

class SetLevelingCommand extends Command {
    constructor() {
        super({
            name: 'setleveling',
            description: 'Configure the server leveling system',
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
                    .setName('config')
                    .setDescription('Configure leveling settings')
                    .addNumberOption(option =>
                        option
                            .setName('xp_rate')
                            .setDescription('XP multiplier (default: 1.0)')
                            .setMinValue(0.1)
                            .setMaxValue(5.0))
                    .addIntegerOption(option =>
                        option
                            .setName('base_xp')
                            .setDescription('Base XP per message (default: 15)')
                            .setMinValue(1)
                            .setMaxValue(100))
                    .addIntegerOption(option =>
                        option
                            .setName('voice_xp')
                            .setDescription('XP per minute in voice (default: 10)')
                            .setMinValue(1)
                            .setMaxValue(50))
                    .addIntegerOption(option =>
                        option
                            .setName('cooldown')
                            .setDescription('Cooldown between XP gains in seconds (default: 60)')
                            .setMinValue(30)
                            .setMaxValue(300))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('rewards')
                    .setDescription('Configure level rewards')
                    .addIntegerOption(option =>
                        option
                            .setName('level')
                            .setDescription('Level to assign the role at')
                            .setRequired(true)
                            .setMinValue(1))
                    .addRoleOption(option =>
                        option
                            .setName('role')
                            .setDescription('Role to assign')
                            .setRequired(true))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('announce')
                    .setDescription('Configure level-up announcements')
                    .addChannelOption(option =>
                        option
                            .setName('channel')
                            .setDescription('Channel for level-up announcements (none for DM)'))
                    .addStringOption(option =>
                        option
                            .setName('message')
                            .setDescription('Custom level-up message ({user} and {level} placeholders available)'))
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('toggle')
                    .setDescription('Toggle the leveling system')
                    .addBooleanOption(option =>
                        option
                            .setName('enabled')
                            .setDescription('Enable or disable the leveling system')
                            .setRequired(true))
            );
    }

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'config':
                await this.handleConfig(interaction);
                break;
            case 'rewards':
                await this.handleRewards(interaction);
                break;
            case 'announce':
                await this.handleAnnounce(interaction);
                break;
            case 'toggle':
                await this.handleToggle(interaction);
                break;
        }
    }

    async handleConfig(interaction) {
        const xpRate = interaction.options.getNumber('xp_rate');
        const baseXP = interaction.options.getInteger('base_xp');
        const voiceXP = interaction.options.getInteger('voice_xp');
        const cooldown = interaction.options.getInteger('cooldown');

        try {
            const updateData = {};
            if (xpRate) updateData['levelingConfig.xpRate'] = xpRate;
            if (baseXP) updateData['levelingConfig.baseXP'] = baseXP;
            if (voiceXP) updateData['levelingConfig.voiceXP'] = voiceXP;
            if (cooldown) updateData['levelingConfig.cooldown'] = cooldown;

            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { $set: updateData },
                { upsert: true }
            );

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Leveling configuration updated successfully'
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error updating leveling config:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to update leveling configuration'
                }],
                ephemeral: true
            });
        }
    }

    async handleRewards(interaction) {
        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');

        try {
            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { 
                    $push: { 
                        'levelingConfig.rewards': {
                            level: level,
                            roleId: role.id
                        }
                    }
                },
                { upsert: true }
            );

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : Successfully added role reward ${role} for level ${level}`
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error setting level reward:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to set level reward'
                }],
                ephemeral: true
            });
        }
    }

    async handleAnnounce(interaction) {
        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');

        try {
            const updateData = {};
            if (channel) updateData['levelingConfig.announceChannel'] = channel.id;
            if (message) updateData['levelingConfig.announceMessage'] = message;

            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { $set: updateData },
                { upsert: true }
            );

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : Level-up announcements will ${channel ? `be sent to ${channel}` : 'be sent via DM'}`
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error updating announcement settings:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to update announcement settings'
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
                { $set: { 'levelingConfig.enabled': enabled } },
                { upsert: true }
            );

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : Leveling system has been ${enabled ? 'enabled' : 'disabled'}`
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error toggling leveling system:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to toggle leveling system'
                }],
                ephemeral: true
            });
        }
    }
}

module.exports = SetLevelingCommand; 