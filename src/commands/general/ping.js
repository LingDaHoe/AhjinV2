const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Command = require('../../structures/Command');

class PingCommand extends Command {
    constructor() {
        super({
            name: 'ping',
            description: 'Check bot latency',
            category: 'general',
            cooldown: 5,
            permissions: [PermissionFlagsBits.SendMessages],
        });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description);
    }

    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        
        await interaction.editReply({
            content: `Pong! 🏓\nBot Latency: ${latency}ms\nWebSocket: ${interaction.client.ws.ping}ms`
        });
    }
}

module.exports = PingCommand; 