const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Command = require('../../structures/Command');

class PurgeCommand extends Command {
    constructor() {
        super({
            name: 'purge',
            description: 'Delete a specified number of messages',
            category: 'moderation',
            permissions: [PermissionFlagsBits.ManageMessages],
        });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addIntegerOption(option =>
                option
                    .setName('amount')
                    .setDescription('Number of messages to delete (1-100)')
                    .setMinValue(1)
                    .setMaxValue(100)
                    .setRequired(true)
            )
            .addUserOption(option =>
                option
                    .setName('target')
                    .setDescription('Delete messages from a specific user')
                    .setRequired(false)
            );
    }

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const target = interaction.options.getUser('target');

        await interaction.deferReply({ ephemeral: true });

        try {
            const messages = await interaction.channel.messages.fetch({ limit: amount + 1 });
            
            let filteredMessages = messages;
            if (target) {
                filteredMessages = messages.filter(msg => msg.author.id === target.id);
            }

            const deleted = await interaction.channel.bulkDelete(filteredMessages, true);

            await interaction.editReply({
                embeds: [{
                    color: 0x00ff00,
                    title: '🧹 Messages Purged',
                    description: `Successfully deleted ${deleted.size - 1} messages${target ? ` from ${target}` : ''}.`,
                    footer: { text: 'Messages older than 14 days cannot be bulk deleted' }
                }]
            });
        } catch (error) {
            await interaction.editReply({
                embeds: [{
                    color: 0x36393F,
                    title: '❌ Error',
                    description: 'Failed to delete messages. Messages older than 14 days cannot be bulk deleted.',
                }]
            });
        }
    }
}

module.exports = PurgeCommand; 