const { SlashCommandBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const GuildSettings = require('../../models/GuildSettings');

class SetTranslationCommand extends Command {
    constructor() {
        super('settranslation');
    }

    data() {
        return new SlashCommandBuilder()
            .setName('settranslation')
            .setDescription('Configure the translation system')
            .setDefaultMemberPermissions(0x8) // Administrator permission
            .addSubcommand(subcommand =>
                subcommand
                    .setName('toggle')
                    .setDescription('Toggle the translation system')
                    .addBooleanOption(option =>
                        option
                            .setName('enabled')
                            .setDescription('Enable or disable automatic translations')
                            .setRequired(true)
                    )
            );
    }

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'toggle') {
            await this.handleToggle(interaction);
        }
    }

    async handleToggle(interaction) {
        const enabled = interaction.options.getBoolean('enabled');

        try {
            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { $set: { 'translationConfig.enabled': enabled } },
                { upsert: true }
            );

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : Translation system has been ${enabled ? 'enabled' : 'disabled'}`
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error toggling translation system:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to toggle translation system'
                }],
                ephemeral: true
            });
        }
    }
}

module.exports = SetTranslationCommand; 