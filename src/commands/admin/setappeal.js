const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Command = require('../../structures/Command');
const GuildConfig = require('../../models/GuildConfig');

class SetAppealCommand extends Command {
    constructor() {
        super({
            name: 'setappeal',
            description: 'Set the channel for ban appeals',
            category: 'admin',
            userPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The channel where ban appeals will be sent')
                    .setRequired(true)
            );
    }

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');

        try {
            console.log('Setting appeal channel for guild:', interaction.guild.id);
            console.log('Channel ID:', channel.id);

            // First, let's check if a config exists
            let guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            console.log('Existing config:', guildConfig);

            if (guildConfig) {
                // Update existing config
                guildConfig.appealChannelId = channel.id;
                guildConfig.updatedAt = new Date();
                guildConfig.updatedBy = interaction.user.id;
                await guildConfig.save();
            } else {
                // Create new config
                guildConfig = new GuildConfig({
                    guildId: interaction.guild.id,
                    appealChannelId: channel.id,
                    updatedAt: new Date(),
                    updatedBy: interaction.user.id
                });
                await guildConfig.save();
            }

            console.log('Saved config:', guildConfig);

            // Verify the save
            const verifyConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            console.log('Verified config:', verifyConfig);

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱ Protection** : Successfully set ban appeals channel to ${channel}`
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error setting appeal channel:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱ Protection** : Failed to set appeal channel'
                }],
                ephemeral: true
            });
        }
    }
}

module.exports = SetAppealCommand; 