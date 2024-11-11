const { Events, EmbedBuilder } = require('discord.js');
const GuildSettings = require('../models/GuildSettings');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (user.bot) return;

        console.log('Reaction received:', {
            emoji: reaction.emoji.name,
            messageId: reaction.message.id,
            userId: user.id
        });

        // Fetch partial reaction if needed
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('Error fetching reaction:', error);
                return;
            }
        }

        // Handle survival giveaway reactions
        const survivalGame = reaction.client.giveaways.get(`survival_${reaction.message.id}`);
        if (survivalGame?.type === 'survival' && reaction.emoji.name === '🎮') {
            const currentTime = Date.now();
            if (currentTime < survivalGame.startTime.getTime()) {
                try {
                    const embed = EmbedBuilder.from(reaction.message.embeds[0]);
                    const participants = (await reaction.users.fetch()).filter(u => !u.bot).size;
                    
                    embed.setDescription(
                        embed.data.description.replace(
                            /\*\*Participants:\*\* \d+/,
                            `**Participants:** ${participants}`
                        )
                    );

                    await reaction.message.edit({ embeds: [embed] });
                } catch (error) {
                    console.error('Error updating survival giveaway participants:', error);
                }
            } else {
                // Remove reactions after game starts
                await reaction.users.remove(user);
            }
        }
    }
}; 