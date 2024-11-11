const translate = require('translate-google');
const GuildSettings = require('../models/GuildSettings');

class TranslationSystem {
    static async detectAndTranslate(text, guildId) {
        try {
            // Check if translations are enabled for this guild
            const settings = await GuildSettings.findOne({ guildId });
            if (!settings?.translationConfig?.enabled) {
                return null;
            }

            const result = await translate(text, { to: 'en' });
            
            if (result.toLowerCase() === text.toLowerCase()) {
                return null;
            }

            return {
                originalText: text,
                translatedText: result
            };
        } catch (error) {
            console.error('Translation error:', error);
            return null;
        }
    }
}

module.exports = TranslationSystem; 