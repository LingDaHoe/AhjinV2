const User = require('../models/User');
const GuildSettings = require('../models/GuildSettings');

class LevelingManager {
    constructor(client) {
        this.client = client;
        this.cache = new Map();
    }

    calculateRequiredXP(level) {
        return Math.floor(100 * Math.pow(1.5, level));
    }

    async handleMessage(message) {
        if (!message.guild || message.author.bot) return;

        const settings = await GuildSettings.findOne({ guildId: message.guild.id });
        if (!settings?.levelingConfig?.enabled) return;

        const key = `${message.author.id}-${message.guild.id}`;
        const lastMessage = this.cache.get(key);
        
        if (lastMessage && Date.now() - lastMessage < settings.levelingConfig.cooldown * 1000) return;
        this.cache.set(key, Date.now());

        try {
            let userData = await User.findOne({ 
                userId: message.author.id,
                guildId: message.guild.id
            });

            if (!userData) {
                userData = new User({
                    userId: message.author.id,
                    guildId: message.guild.id
                });
            }

            userData.xp += Math.floor(settings.levelingConfig.baseXP * settings.levelingConfig.xpRate);
            const requiredXP = this.calculateRequiredXP(userData.level);

            if (userData.xp >= requiredXP) {
                userData.level += 1;
                userData.xp -= requiredXP;
                await this.handleLevelUp(message.member, userData, settings);
            }

            await userData.save();
        } catch (error) {
            console.error('Error handling message XP:', error);
        }
    }

    async handleVoiceStateUpdate(oldState, newState) {
        if (!oldState.guild) return;

        const settings = await GuildSettings.findOne({ guildId: oldState.guild.id });
        if (!settings?.levelingConfig?.enabled) return;

        try {
            let userData = await User.findOne({
                userId: oldState.member.id,
                guildId: oldState.guild.id
            });

            if (!userData) {
                userData = new User({
                    userId: oldState.member.id,
                    guildId: oldState.guild.id
                });
            }

            // Handle voice join
            if (!oldState.channelId && newState.channelId) {
                userData.lastVoiceJoinTimestamp = new Date();
            }
            // Handle voice leave
            else if (oldState.channelId && !newState.channelId && userData.lastVoiceJoinTimestamp) {
                const voiceTime = Math.floor((Date.now() - userData.lastVoiceJoinTimestamp) / 60000);
                userData.voiceTime += voiceTime;
                
                const xpGained = Math.floor(voiceTime * settings.levelingConfig.voiceXP * settings.levelingConfig.xpRate);
                userData.xp += xpGained;

                const requiredXP = this.calculateRequiredXP(userData.level);
                if (userData.xp >= requiredXP) {
                    userData.level += 1;
                    userData.xp -= requiredXP;
                    await this.handleLevelUp(oldState.member, userData, settings);
                }

                userData.lastVoiceJoinTimestamp = null;
            }

            await userData.save();
        } catch (error) {
            console.error('Error handling voice XP:', error);
        }
    }

    async handleLevelUp(member, userData, settings) {
        if (!settings.levelingConfig.announceChannel && !settings.levelingConfig.announceDM) return;

        const message = settings.levelingConfig.announceMessage
            .replace('{user}', member.toString())
            .replace('{level}', userData.level);

        try {
            if (settings.levelingConfig.announceChannel) {
                const channel = member.guild.channels.cache.get(settings.levelingConfig.announceChannel);
                if (channel) {
                    await channel.send({
                        embeds: [{
                            color: 0x438BEF,
                            description: message
                        }]
                    });
                }
            }

            if (settings.levelingConfig.announceDM) {
                await member.send({
                    embeds: [{
                        color: 0x438BEF,
                        description: `🎉 You've reached level ${userData.level} in ${member.guild.name}!`
                    }]
                }).catch(() => {});
            }

            // Handle role rewards
            if (settings.levelingConfig.rewards?.length) {
                const rewards = settings.levelingConfig.rewards.filter(r => r.level === userData.level);
                for (const reward of rewards) {
                    const role = member.guild.roles.cache.get(reward.roleId);
                    if (role) {
                        await member.roles.add(role).catch(console.error);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling level up:', error);
        }
    }
}

module.exports = LevelingManager;