const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const User = require('../../models/User');
const GuildSettings = require('../../models/GuildSettings');

class LeaderboardCommand extends Command {
    constructor() {
        super({
            name: 'leaderboard',
            description: 'View the server\'s leveling leaderboard',
            category: 'leveling'
        });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option
                    .setName('type')
                    .setDescription('Type of leaderboard to view')
                    .setRequired(false)
                    .addChoices(
                        { name: 'XP', value: 'xp' },
                        { name: 'Voice Time', value: 'voice' }
                    )
            );
    }

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            if (!settings?.levelingConfig?.enabled) {
                return interaction.editReply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱** : Leveling system is not enabled on this server'
                    }]
                });
            }

            const type = interaction.options.getString('type') || 'xp';
            const sortField = type === 'xp' ? 'level' : 'voiceTime';
            
            const users = await User.find({ guildId: interaction.guild.id })
                .sort({ [sortField]: -1, xp: -1 })
                .limit(10);

            if (!users.length) {
                return interaction.editReply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱** : No users found in the leaderboard'
                    }]
                });
            }

            const leaderboardEmbed = new EmbedBuilder()
                .setColor(0x438BEF)
                .setTitle(`🏆 ${interaction.guild.name} Leaderboard`)
                .setDescription(await this.formatLeaderboard(interaction.guild, users, type))
                .setTimestamp();

            await interaction.editReply({ embeds: [leaderboardEmbed] });

        } catch (error) {
            console.error('Error displaying leaderboard:', error);
            await interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : An error occurred while fetching the leaderboard'
                }]
            });
        }
    }

    async formatLeaderboard(guild, users, type) {
        const entries = await Promise.all(users.map(async (user, index) => {
            const member = await guild.members.fetch(user.userId).catch(() => null);
            if (!member) return null;

            if (type === 'xp') {
                return `\`${index + 1}.\` ${member.user.tag}\n> Level: ${user.level} • XP: ${user.xp}`;
            } else {
                const hours = Math.floor(user.voiceTime / 60);
                const minutes = user.voiceTime % 60;
                return `\`${index + 1}.\` ${member.user.tag}\n> Voice Time: ${hours}h ${minutes}m`;
            }
        }));

        return entries.filter(entry => entry !== null).join('\n');
    }
}

module.exports = LeaderboardCommand; 