const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Command = require('../../structures/Command');
const GuildSettings = require('../../models/GuildSettings');

class SetLogsCommand extends Command {
    constructor() {
        super({
            name: 'setmodlogs',
            description: 'Set the channel for moderation logs',
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
                    .setDescription('The channel to send moderation logs to')
                    .setRequired(true)
            );
    }

    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');

        try {
            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guildId },
                { 
                    guildId: interaction.guildId,
                    logChannel: channel.id
                },
                { upsert: true }
            );

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> Ahjin ♱ : Successfully set moderation logs to ${channel}`
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error setting log channel:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> Ahjin ♱ : Failed to set log channel'
                }],
                ephemeral: true
            });
        }
    }
}

module.exports = SetLogsCommand; 