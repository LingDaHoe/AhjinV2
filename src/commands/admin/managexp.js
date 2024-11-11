const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Command = require('../../structures/Command');
const User = require('../../models/User');

class ManageXPCommand extends Command {
    constructor() {
        super({
            name: 'managexp',
            description: 'Manage user XP and levels',
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
                    .setName('setlevel')
                    .setDescription('Set a user\'s level')
                    .addUserOption(option =>
                        option
                            .setName('user')
                            .setDescription('The user to modify')
                            .setRequired(true))
                    .addIntegerOption(option =>
                        option
                            .setName('level')
                            .setDescription('The level to set')
                            .setRequired(true)
                            .setMinValue(0)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('addxp')
                    .setDescription('Add XP to a user')
                    .addUserOption(option =>
                        option
                            .setName('user')
                            .setDescription('The user to modify')
                            .setRequired(true))
                    .addIntegerOption(option =>
                        option
                            .setName('amount')
                            .setDescription('Amount of XP to add')
                            .setRequired(true)
                            .setMinValue(1)));
    }

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');

        try {
            let userData = await User.findOne({
                userId: targetUser.id,
                guildId: interaction.guild.id
            });

            if (!userData) {
                userData = new User({
                    userId: targetUser.id,
                    guildId: interaction.guild.id,
                    level: 0,
                    xp: 0
                });
            }

            if (subcommand === 'setlevel') {
                const newLevel = interaction.options.getInteger('level');
                userData.level = newLevel;
                userData.xp = 0;
                await userData.save();

                await interaction.editReply({
                    embeds: [{
                        color: 0x438BEF,
                        description: `> **Ahjin ♱** : Set ${targetUser}'s level to ${newLevel}`
                    }]
                });
            } else if (subcommand === 'addxp') {
                const amount = interaction.options.getInteger('amount');
                userData.xp += amount;

                // Check if user levels up
                const requiredXP = interaction.client.levelingManager.calculateRequiredXP(userData.level);
                while (userData.xp >= requiredXP) {
                    userData.level += 1;
                    userData.xp -= requiredXP;
                }

                await userData.save();

                await interaction.editReply({
                    embeds: [{
                        color: 0x438BEF,
                        description: `> **Ahjin ♱** : Added ${amount} XP to ${targetUser}. They are now level ${userData.level} with ${userData.xp} XP`
                    }]
                });
            }
        } catch (error) {
            console.error('Error managing XP:', error);
            await interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : An error occurred while managing XP'
                }]
            });
        }
    }
}

module.exports = ManageXPCommand; 