const { Collection, PermissionFlagsBits } = require('discord.js');
const { createWarning } = require('../utils/moderation');

class SpamManager {
    constructor() {
        // Track messages per user
        this.userMessages = new Collection();
        // Track warnings per user
        this.warnings = new Collection();
        // Track muted users
        this.mutedUsers = new Collection();
        // Track user offenses
        this.userOffenses = new Collection();
        // Track punishment levels
        this.punishmentLevels = [
            { threshold: 2, action: 'warn' },
            { threshold: 4, action: 'tempmute', duration: 5 * 60 * 1000 },
            { threshold: 6, action: 'tempmute', duration: 15 * 60 * 1000 },
            { threshold: 8, action: 'tempban', duration: 24 * 60 * 60 * 1000 }
        ];
        
        // Configuration
        this.config = {
            messageThreshold: 5, // Number of messages
            timeWindow: 5000,    // Time window in ms (5 seconds)
            duplicateThreshold: 3, // Number of duplicate messages
            mentionLimit: 4,     // Maximum mentions per message
            warnThreshold: 2,    // Warnings before mute
            timeoutDuration: 300000,    // Timeout duration in ms (5 minutes)
            linkLimit: 2,        // Maximum links per message
            maxMessageLength: 1000, // Maximum message length
            rateLimits: {
                normal: { messages: 5, period: 5000 },
                medium: { messages: 10, period: 15000 },
                strict: { messages: 3, period: 3000 }
            },
            emojiLimit: 10,            // Maximum emojis per message
            capsLimit: 0.7,            // Maximum percentage of caps allowed
            similarityThreshold: 0.85  // Levenshtein distance threshold for similar messages
        };

        this.joinTracker = new Collection();
        this.raidMode = new Collection();
        this.messageCache = new Map();
        this.CACHE_LIFETIME = 60000; // 1 minute

        this.analytics = {
            spamDetections: 0,
            warnings: 0,
            mutes: 0,
            bans: 0
        };

        this.enabledGuilds = new Set();
    }

    async handleMessage(message) {
        if (message.author.bot) return;
        if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return;

        const userId = message.author.id;
        const currentTime = Date.now();

        // Check if user is muted
        if (this.isUserMuted(userId)) {
            await message.delete().catch(() => {});
            return;
        }

        // Initialize user's message history
        if (!this.userMessages.has(userId)) {
            this.userMessages.set(userId, []);
        }

        const userMessageHistory = this.userMessages.get(userId);
        
        // Add current message to history
        userMessageHistory.push({
            content: message.content,
            timestamp: currentTime
        });

        // Remove old messages outside the time window
        const recentMessages = userMessageHistory.filter(
            msg => currentTime - msg.timestamp <= this.config.timeWindow
        );
        this.userMessages.set(userId, recentMessages);

        // Check for spam patterns
        if (await this.isSpam(message, recentMessages)) {
            await this.handleSpam(message);
        }
    }

    async isSpam(message, recentMessages) {
        // Check message frequency
        if (recentMessages.length >= this.config.messageThreshold) {
            return true;
        }

        // Check duplicate messages
        const duplicateCount = recentMessages.filter(
            msg => msg.content === message.content
        ).length;
        if (duplicateCount >= this.config.duplicateThreshold) {
            return true;
        }

        // Check mention spam
        if (message.mentions.users.size > this.config.mentionLimit) {
            return true;
        }

        // Check message length
        if (message.content.length > this.config.maxMessageLength) {
            return true;
        }

        // Check link spam
        const linkCount = (message.content.match(/https?:\/\/[^\s]+/g) || []).length;
        if (linkCount > this.config.linkLimit) {
            return true;
        }

        // Check for invite links
        const hasInviteLink = /(discord\.(gg|io|me|li)|discordapp\.com\/invite)/.test(message.content);
        if (hasInviteLink) {
            return true;
        }

        return false;
    }

    async handleSpam(message) {
        // Check if anti-spam is enabled for this guild
        if (!this.enabledGuilds.has(message.guild.id)) return;

        const userId = message.author.id;

        // Delete spam message
        await message.delete().catch(() => {});

        // Increment warnings
        const currentWarnings = this.warnings.get(userId) || 0;
        this.warnings.set(userId, currentWarnings + 1);

        // Create warning in database
        await createWarning({
            userId: userId,
            guildId: message.guild.id,
            moderatorId: message.client.user.id,
            reason: 'Automated: Spam Detection'
        });

        // Check if user should be timed out
        if (currentWarnings + 1 >= this.config.warnThreshold) {
            await this.timeoutUser(message);
        } else {
            // Send ephemeral warning message
            await message.channel.send({
                embeds: [{
                    color: 0xffdd00,
                    title: '⚠️ Spam Warning',
                    description: `${message.author}, please avoid spamming. Warning ${currentWarnings + 1}/${this.config.warnThreshold}`,
                    footer: {
                        text: `Next violation will result in a ${this.config.timeoutDuration / 60000} minute timeout`
                    }
                }]
            }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));
        }
    }

    async timeoutUser(message) {
        const userId = message.author.id;

        try {
            const member = message.member;
            if (!member) return;

            // Convert duration to milliseconds and ensure it's a number
            const duration = Number(this.config.timeoutDuration);
            
            if (isNaN(duration)) {
                console.error('Invalid timeout duration:', this.config.timeoutDuration);
                return;
            }

            // Apply timeout
            await member.timeout(duration, 'Automated: Spam Detection');
            
            // Send notification
            await message.channel.send({
                embeds: [{
                    color: 0xff0000,
                    title: '⏰ User Timed Out',
                    description: `${message.author} has been timed out for ${duration / 60000} minutes due to spam.`,
                    footer: {
                        text: 'Continuous violations may result in a longer timeout'
                    }
                }]
            }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));

            // Reset warnings
            this.warnings.delete(userId);

        } catch (error) {
            console.error('Error timing out user:', error);
            // Log error to mod-logs if available
            const logChannel = message.guild.channels.cache.find(c => c.name === 'mod-logs');
            if (logChannel) {
                await logChannel.send({
                    embeds: [{
                        color: 0xff0000,
                        title: '⚠️ Timeout Failed',
                        description: `Failed to timeout ${message.author} for spam.\nError: ${error.message}`,
                        timestamp: new Date()
                    }]
                });
            }
        }
    }

    async muteUser(message) {
        const userId = message.author.id;
        const muteRole = await this.getMuteRole(message.guild);

        try {
            // Add mute role
            await message.member.roles.add(muteRole);
            
            // Track muted user
            this.mutedUsers.set(userId, Date.now() + this.config.muteTime);

            // Send mute notification
            const muteEmbed = {
                color: 0xff0000,
                title: '🔇 User Muted',
                description: `${message.author} has been muted for ${this.config.muteTime / 60000} minutes due to spam.`,
                footer: {
                    text: 'Continuous violations may result in a ban'
                }
            };

            await message.channel.send({ embeds: [muteEmbed] })
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));

            // Schedule unmute
            setTimeout(() => this.unmuteUser(message.guild, userId, muteRole), this.config.muteTime);

            // Reset warnings
            this.warnings.delete(userId);

        } catch (error) {
            console.error('Error muting user:', error);
        }
    }

    async getMuteRole(guild) {
        let muteRole = guild.roles.cache.find(role => role.name === 'Muted');

        if (!muteRole) {
            try {
                muteRole = await guild.roles.create({
                    name: 'Muted',
                    color: '#808080',
                    reason: 'Anti-spam system mute role'
                });

                // Set permissions for all channels
                guild.channels.cache.forEach(async (channel) => {
                    await channel.permissionOverwrites.create(muteRole, {
                        SendMessages: false,
                        AddReactions: false,
                        Speak: false
                    }).catch(() => {});
                });
            } catch (error) {
                console.error('Error creating mute role:', error);
            }
        }

        return muteRole;
    }

    async unmuteUser(guild, userId, muteRole) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
            await member.roles.remove(muteRole).catch(() => {});
        }
        this.mutedUsers.delete(userId);
    }

    isUserMuted(userId) {
        if (!this.mutedUsers.has(userId)) return false;
        
        const muteExpiration = this.mutedUsers.get(userId);
        if (Date.now() >= muteExpiration) {
            this.mutedUsers.delete(userId);
            return false;
        }
        return true;
    }

    // Method to clean up old data
    cleanup() {
        const currentTime = Date.now();

        // Clean up old messages
        this.userMessages.forEach((messages, userId) => {
            const recentMessages = messages.filter(
                msg => currentTime - msg.timestamp <= this.config.timeWindow
            );
            
            if (recentMessages.length === 0) {
                this.userMessages.delete(userId);
            } else {
                this.userMessages.set(userId, recentMessages);
            }
        });

        // Clean up expired mutes
        this.mutedUsers.forEach((expirationTime, userId) => {
            if (currentTime >= expirationTime) {
                this.mutedUsers.delete(userId);
            }
        });
    }

    async isMessagePatternSpam(message, recentMessages) {
        const content = message.content;
        
        // Check emoji spam
        const emojiCount = (content.match(/<a?:.+?:\d+>|[\u{1F300}-\u{1F9FF}]/gu) || []).length;
        if (emojiCount > this.config.emojiLimit) {
            return { isSpam: true, reason: 'emoji_spam' };
        }

        // Check caps spam
        const capsCount = (content.match(/[A-Z]/g) || []).length;
        const totalChars = content.replace(/[^a-zA-Z]/g, '').length;
        if (totalChars > 8 && capsCount / totalChars > this.config.capsLimit) {
            return { isSpam: true, reason: 'caps_spam' };
        }

        // Check message similarity with recent messages
        for (const recentMsg of recentMessages) {
            const similarity = this.calculateSimilarity(content, recentMsg.content);
            if (similarity > this.config.similarityThreshold) {
                return { isSpam: true, reason: 'similar_messages' };
            }
        }

        return { isSpam: false };
    }

    async determineAndExecutePunishment(message) {
        const userId = message.author.id;
        const offenses = this.getUserOffenses(userId);
        
        const punishment = this.punishmentLevels.find(level => offenses === level.threshold);
        if (!punishment) return;

        switch (punishment.action) {
            case 'warn':
                await this.handleWarning(message);
                break;
            case 'tempmute':
                await this.handleMute(message, punishment.duration);
                break;
            case 'tempban':
                await this.handleTempBan(message, punishment.duration);
                break;
        }
    }

    async handleTempBan(message, duration) {
        try {
            const reason = 'Automated: Excessive spam violations';
            await message.member.ban({ reason, days: 1 });
            
            setTimeout(async () => {
                await message.guild.members.unban(message.author.id, 'Temporary ban expired');
            }, duration);

            // Log the action
            await this.logModAction(message.guild, {
                type: 'tempban',
                user: message.author,
                duration,
                reason
            });
        } catch (error) {
            console.error('Error handling temporary ban:', error);
        }
    }

    async checkRaidMode(member) {
        const guild = member.guild;
        const now = Date.now();
        
        if (!this.joinTracker.has(guild.id)) {
            this.joinTracker.set(guild.id, []);
        }
        
        const recentJoins = this.joinTracker.get(guild.id);
        recentJoins.push(now);
        
        // Clean old joins
        const recentJoinsFiltered = recentJoins.filter(time => now - time < 10000);
        this.joinTracker.set(guild.id, recentJoinsFiltered);
        
        // Check for raid (10+ joins in 10 seconds)
        if (recentJoinsFiltered.length >= 10 && !this.raidMode.has(guild.id)) {
            await this.enableRaidMode(guild);
        }
    }

    async enableRaidMode(guild) {
        this.raidMode.set(guild.id, true);
        
        // Notify staff
        const logChannel = guild.channels.cache.find(c => c.name === 'mod-logs');
        if (logChannel) {
            await logChannel.send({
                embeds: [{
                    color: 0xFF0000,
                    title: '🚨 RAID MODE ACTIVATED',
                    description: 'Unusual join patterns detected. Enhanced security measures enabled.',
                    timestamp: new Date()
                }]
            });
        }
        
        // Auto-disable after 10 minutes
        setTimeout(() => this.disableRaidMode(guild), 10 * 60 * 1000);
    }

    // Optimize message processing
    async processMessage(message) {
        const cacheKey = `${message.guild.id}-${message.channel.id}-${message.author.id}`;
        const now = Date.now();
        
        // Clean old cache entries
        if (!this.messageCache.has(cacheKey)) {
            this.messageCache.set(cacheKey, {
                lastCleanup: now,
                messages: []
            });
        }
        
        const cache = this.messageCache.get(cacheKey);
        
        // Periodic cleanup
        if (now - cache.lastCleanup > this.CACHE_LIFETIME) {
            cache.messages = cache.messages.filter(msg => now - msg.timestamp < this.CACHE_LIFETIME);
            cache.lastCleanup = now;
        }
        
        cache.messages.push({
            content: message.content,
            timestamp: now
        });
    }

    async logModAction(guild, action) {
        // Update analytics
        this.analytics[action.type]++;
        
        // Log to database
        await ModLog.create({
            guildId: guild.id,
            actionType: action.type,
            targetId: action.user.id,
            moderatorId: guild.client.user.id,
            reason: action.reason,
            duration: action.duration,
            timestamp: new Date()
        });
        
        // Log to channel
        const logChannel = guild.channels.cache.find(c => c.name === 'mod-logs');
        if (logChannel) {
            await logChannel.send({
                embeds: [{
                    color: this.getActionColor(action.type),
                    title: `${this.getActionEmoji(action.type)} ${action.type.toUpperCase()}`,
                    description: `**User:** ${action.user.tag}\n**Reason:** ${action.reason}`,
                    timestamp: new Date()
                }]
            });
        }
    }
}

module.exports = SpamManager; 