const { Events } = require('discord.js');
const GuildSettings = require('../models/GuildSettings');
const User = require('../models/User');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            // Initialize user with level 1
            await User.findOneAndUpdate(
                { userId: member.id, guildId: member.guild.id },
                { $setOnInsert: { level: 1, xp: 0 } },
                { upsert: true }
            );

            const settings = await GuildSettings.findOne({ 
                guildId: member.guild.id,
                'welcomeConfig.enabled': true 
            });

            if (!settings?.welcomeChannel) return;

            const welcomeChannel = member.guild.channels.cache.get(settings.welcomeChannel);
            if (!welcomeChannel) return;

            const welcomeEmbed = new EmbedBuilder()
                .setColor(settings.welcomeConfig.color || 4441071)
                .setTitle(settings.welcomeConfig.title)
                .setDescription(settings.welcomeConfig.description.replace('{user}', member.toString()))
                .setTimestamp();

            if (settings.welcomeConfig.bannerUrl) {
                welcomeEmbed.setImage(settings.welcomeConfig.bannerUrl);
            }

            await welcomeChannel.send({ 
                embeds: [welcomeEmbed]
            });
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }
    }
}; 