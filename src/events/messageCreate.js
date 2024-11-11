const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const TranslationSystem = require('../systems/translationSystem');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;
        
        try {
            await message.client.levelingManager.handleMessage(message);
            await message.client.spamManager.handleMessage(message);
            
            const translation = await TranslationSystem.detectAndTranslate(message.content, message.guild.id);
            
            if (translation) {
                const translationEmbed = new EmbedBuilder()
                    .setColor(0x438BEF)
                    .setDescription([
                        '> **Ahjin ♱** : Message Translation',
                        '',
                        '> Original:',
                        `> ${translation.originalText}`,
                        '',
                        '> English:',
                        `> ${translation.translatedText}`
                    ].join('\n'));

                const dismissButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('dismiss_translation')
                            .setLabel('Dismiss')
                            .setStyle(ButtonStyle.Secondary)
                    );

                const translationMsg = await message.reply({
                    embeds: [translationEmbed],
                    components: [dismissButton]
                });

                // Create collector for the dismiss button
                const collector = translationMsg.createMessageComponentCollector({
                    filter: i => i.customId === 'dismiss_translation',
                    time: 60000 // Button expires after 1 minute
                });

                collector.on('collect', async i => {
                    await i.reply({
                        embeds: [{
                            color: 0x438BEF,
                            description: '> **Ahjin ♱** : Translation dismissed'
                        }],
                        ephemeral: true
                    });
                    await translationMsg.delete();
                });
            }
        } catch (error) {
            console.error('Error in message handling:', error);
        }
    }
}; 