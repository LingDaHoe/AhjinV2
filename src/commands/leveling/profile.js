const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const User = require('../../models/User');
const GuildSettings = require('../../models/GuildSettings');
const Canvas = require('canvas');
const path = require('path');

class ProfileCommand extends Command {
    constructor() {
        super({
            name: 'profile',
            description: 'View your or another user\'s profile card',
            category: 'leveling'
        });
        // Register custom fonts
        Canvas.registerFont(path.join(__dirname, '../../assets/fonts/SpaceMono-Bold.ttf'), { family: 'SpaceMono-Bold' });
        Canvas.registerFont(path.join(__dirname, '../../assets/fonts/SpaceMono-Regular.ttf'), { family: 'SpaceMono' });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addUserOption(option =>
                option
                    .setName('user')
                    .setDescription('The user to view (defaults to yourself)')
                    .setRequired(false)
            );
    }

    async execute(interaction) {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        try {
            const userData = await User.findOne({
                userId: targetUser.id,
                guildId: interaction.guild.id
            });

            if (!userData) {
                return interaction.editReply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱** : This user has no profile data yet'
                    }]
                });
            }

            const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            if (!settings?.levelingConfig?.enabled) {
                return interaction.editReply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱** : Leveling system is not enabled on this server'
                    }]
                });
            }

            // Create rank card
            const rankCard = await this.createRankCard(targetUser, userData);
            const attachment = new AttachmentBuilder(rankCard, { name: 'profile.png' });

            await interaction.editReply({
                files: [attachment]
            });

        } catch (error) {
            console.error('Error displaying profile:', error);
            await interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : An error occurred while fetching the profile'
                }]
            });
        }
    }

    async createRankCard(user, userData) {
        const canvas = Canvas.createCanvas(600, 300);
        const ctx = canvas.getContext('2d');

        // Get user's rank calculation
        const userRank = await User.countDocuments({
            guildId: userData.guildId,
            $or: [
                { level: { $gt: userData.level } },
                { level: userData.level, xp: { $gt: userData.xp } }
            ]
        }) + 1;

        // Background with sleek gradient
        const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        bgGradient.addColorStop(0, '#0a0612');
        bgGradient.addColorStop(1, '#1a0b2e');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Main container
        this.drawGlassPanel(ctx, 10, 10, canvas.width - 20, canvas.height - 20);

        // Avatar section (left)
        const avatarSize = 100;
        const avatarX = 25;
        const avatarY = 25;

        // Draw avatar
        const avatar = await Canvas.loadImage(user.displayAvatarURL({ extension: 'png', size: 512 }));
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();

        // Username, Level, and Rank
        this.drawNeonText(ctx, user.username, avatarX, avatarY + avatarSize + 30, '#ffffff', '#9b6dff', '20px SpaceMono-Bold');
        this.drawNeonText(ctx, `Level ${userData.level}`, avatarX, avatarY + avatarSize + 55, '#c4a1ff', '#9b6dff', '16px SpaceMono');
        this.drawNeonText(ctx, `Rank #${userRank}`, avatarX, avatarY + avatarSize + 75, '#c4a1ff', '#9b6dff', '16px SpaceMono');

        // Right side content
        const rightX = 150;
        const rightWidth = canvas.width - rightX - 25;

        // XP Progress bar
        const requiredXP = this.calculateRequiredXP(userData.level);
        const percentage = Math.floor((userData.xp / requiredXP) * 100);
        this.drawCrystalProgressBar(ctx, rightX, 30, rightWidth, 20, percentage,
            `${userData.xp.toLocaleString()} / ${requiredXP.toLocaleString()} XP`);

        // Stats in 2x2 grid
        const stats = [
            { icon: '📊', label: 'TOTAL XP', value: userData.xp.toLocaleString() },
            { icon: '🎯', label: 'MESSAGES', value: (userData.messageCount || 0).toLocaleString() },
            { icon: '🎤', label: 'VOICE', value: `${Math.floor(userData.voiceTime / 60)}h` },
            { icon: '🏆', label: 'ACHIEVEMENTS', value: this.calculateAchievements(userData).length }
        ];

        const statBoxSize = { width: rightWidth / 2 - 10, height: 80 };
        stats.forEach((stat, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = rightX + col * (statBoxSize.width + 20);
            const y = 70 + row * (statBoxSize.height + 10);
            this.drawCompactStatBox(ctx, stat, x, y, statBoxSize.width, statBoxSize.height);
        });

        return canvas.toBuffer();
    }

    drawGlassPanel(ctx, x, y, width, height) {
        ctx.save();
        ctx.globalAlpha = 0.1;
        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, '#9b6dff');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 20);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    drawParticles(ctx, width, height) {
        // Store particle positions for animation
        if (!this.particles) {
            this.particles = Array.from({ length: 50 }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 2,
                speedY: (Math.random() - 0.5) * 2,
                opacity: Math.random() * 0.5
            }));
        }

        // Update and draw particles
        this.particles.forEach(particle => {
            // Update position
            particle.x += particle.speedX;
            particle.y += particle.speedY;

            // Wrap around edges
            if (particle.x < 0) particle.x = width;
            if (particle.x > width) particle.x = 0;
            if (particle.y < 0) particle.y = height;
            if (particle.y > height) particle.y = 0;

            // Draw particle with glow
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            
            // Gradient glow
            const gradient = ctx.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, particle.size * 2
            );
            gradient.addColorStop(0, `rgba(155, 109, 255, ${particle.opacity})`);
            gradient.addColorStop(1, 'rgba(155, 109, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.fill();
        });
    }

    drawAchievements(ctx, userData, x, y) {
        const achievements = this.calculateAchievements(userData);
        ctx.font = '28px SpaceMono-Bold';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Achievements', x, y);

        // More space between achievement badges
        achievements.forEach((achievement, index) => {
            this.drawAchievementBadge(ctx, achievement, x + (index * 160), y + 50);
        });
    }

    drawAdvancedStats(ctx, userData, x, y) {
        const stats = [
            { icon: '🎯', label: 'Messages', value: userData.messageCount || 0 },
            { icon: '🎤', label: 'Voice Hours', value: Math.floor(userData.voiceTime / 60) },
            { icon: '⭐', label: 'Total XP', value: userData.totalXP || userData.xp },
            { icon: '🏆', label: 'Achievements', value: this.calculateAchievements(userData).length }
        ];

        // More space between stat boxes
        stats.forEach((stat, index) => {
            this.drawStatBox(ctx, `${stat.icon} ${stat.label}\n${stat.value}`, x + (index * 280), y);
        });
    }

    drawHexagonPattern(ctx, width, height) {
        const size = 30;
        const h = size * Math.sqrt(3);
        for (let x = 0; x < width + size; x += size * 1.5) {
            for (let y = 0; y < height + h; y += h) {
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = 2 * Math.PI / 6 * i;
                    const xPos = x + size * Math.cos(angle);
                    const yPos = y + size * Math.sin(angle);
                    i === 0 ? ctx.moveTo(xPos, yPos) : ctx.lineTo(xPos, yPos);
                }
                ctx.closePath();
                ctx.strokeStyle = '#9b6dff';
                ctx.stroke();
            }
        }
    }

    drawCrystalFrame(ctx, x, y, size) {
        ctx.save();
        const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
        gradient.addColorStop(0, '#9b6dff');
        gradient.addColorStop(0.5, '#c4a1ff');
        gradient.addColorStop(1, '#9b6dff');

        // Multiple layers for crystal effect
        for (let i = 0; i < 3; i++) {
            ctx.shadowColor = '#9b6dff';
            ctx.shadowBlur = 15 - i * 5;
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 3 - i;
            ctx.beginPath();
            ctx.arc(x + size/2, y + size/2, size/2 + 5 - i * 2, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawNeonText(ctx, text, x, y, color, glowColor, font, glow) {
        ctx.font = font;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = glowColor;
        ctx.fillText(text, x, y);
        ctx.shadowBlur = 5;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.shadowBlur = 0;
        if (glow) {
            ctx.shadowColor = '#9b6dff';
            ctx.shadowBlur = 20;
            ctx.fillStyle = '#9b6dff';
            ctx.fillText(text, x, y);
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x, y);
            ctx.shadowBlur = 0;
        }
    }

    drawCrystalProgressBar(ctx, x, y, width, height, percentage, text) {
        // Background
        const bgGradient = ctx.createLinearGradient(x, y, x + width, y);
        bgGradient.addColorStop(0, '#2a1b3d80');
        bgGradient.addColorStop(1, '#37254980');
        ctx.fillStyle = bgGradient;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, height/2);
        ctx.fill();

        // Progress
        const progress = (percentage / 100) * width;
        const progressGradient = ctx.createLinearGradient(x, y, x + progress, y);
        progressGradient.addColorStop(0, '#9b6dff');
        progressGradient.addColorStop(0.5, '#c4a1ff');
        progressGradient.addColorStop(1, '#9b6dff');

        ctx.shadowColor = '#9b6dff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = progressGradient;
        ctx.beginPath();
        ctx.roundRect(x, y, progress, height, height/2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Percentage text
        ctx.font = '16px SpaceMono-Bold';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(text, x + width/2, y + height/2 + 5);
        ctx.textAlign = 'left';
    }

    drawStats(ctx, userData, x, y) {
        const hours = Math.floor(userData.voiceTime / 60);
        const minutes = userData.voiceTime % 60;
        ctx.font = '20px SpaceMono';
        ctx.fillStyle = '#c4a1ff';
        ctx.fillText(`🎤 Voice Time: ${hours}h ${minutes}m`, x, y);
    }

    calculateRequiredXP(level) {
        return Math.floor(100 * Math.pow(1.5, level));
    }

    drawCrystalBadge(ctx, text, x, y) {
        // Badge background with crystal effect
        const width = 100;
        const height = 40;
        
        // Crystal background
        const gradient = ctx.createLinearGradient(x, y - height, x + width, y);
        gradient.addColorStop(0, '#9b6dff40');
        gradient.addColorStop(1, '#c4a1ff40');
        
        ctx.shadowColor = '#9b6dff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y - height, width, height, 10);
        ctx.fill();
        
        // Badge border
        ctx.strokeStyle = '#9b6dff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Badge text
        this.drawNeonText(ctx, text, x + 20, y - 10, '#ffffff', '#9b6dff', '24px SpaceMono-Bold');
        ctx.shadowBlur = 0;
    }

    drawGlowingLevel(ctx, level, x, y) {
        const text = `LEVEL ${level}`;
        
        // Outer glow
        ctx.shadowColor = '#9b6dff';
        ctx.shadowBlur = 20;
        ctx.font = '32px SpaceMono-Bold';
        ctx.fillStyle = '#9b6dff';
        ctx.fillText(text, x, y);
        
        // Inner text
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, x, y);
        ctx.shadowBlur = 0;
    }

    calculateAchievements(userData) {
        const achievements = [];
        if (userData.level >= 10) achievements.push({ name: 'Rising Star', icon: '⭐' });
        if (userData.level >= 25) achievements.push({ name: 'Elite', icon: '👑' });
        if (userData.voiceTime >= 600) achievements.push({ name: 'Chatterbox', icon: '🎤' });
        if (userData.messageCount >= 1000) achievements.push({ name: 'Dedicated', icon: '🎯' });
        return achievements;
    }

    drawAchievementBadge(ctx, achievement, x, y) {
        // Badge background
        ctx.save();
        ctx.shadowColor = '#9b6dff';
        ctx.shadowBlur = 10;
        const gradient = ctx.createLinearGradient(x, y, x + 100, y + 100);
        gradient.addColorStop(0, '#2a1b3d');
        gradient.addColorStop(1, '#372549');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, 100, 100, 10);
        ctx.fill();

        // Achievement icon
        ctx.font = '40px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(achievement.icon, x + 30, y + 50);

        // Achievement name
        ctx.font = '16px SpaceMono';
        ctx.fillText(achievement.name, x + 10, y + 80);
        ctx.restore();
    }

    drawStatBox(ctx, stat, x, y, width) {
        const height = 80;
        
        // Box background
        ctx.save();
        ctx.shadowColor = '#9b6dff';
        ctx.shadowBlur = 15;
        
        const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
        gradient.addColorStop(0, '#2a1b3d90');
        gradient.addColorStop(1, '#37254990');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 10);
        ctx.fill();

        // Accent line
        const lineGradient = ctx.createLinearGradient(x, y, x + width, y);
        lineGradient.addColorStop(0, '#9b6dff');
        lineGradient.addColorStop(1, '#c4a1ff');
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 2);
        ctx.lineTo(x + width - 10, y + 2);
        ctx.stroke();

        // Content
        ctx.font = '20px SpaceMono-Bold';
        ctx.fillStyle = '#9b6dff';
        ctx.fillText(stat.icon, x + 20, y + 35);
        
        ctx.font = '16px SpaceMono';
        ctx.fillStyle = '#c4a1ff';
        ctx.fillText(stat.label, x + 50, y + 35);
        
        ctx.font = '24px SpaceMono-Bold';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(stat.value, x + 20, y + 65);
        
        ctx.restore();
    }

    // New helper method for section titles
    drawSectionTitle(ctx, title, x, y) {
        ctx.save();
        // Purple line before text
        ctx.beginPath();
        ctx.strokeStyle = '#9b6dff';
        ctx.lineWidth = 3;
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x + 30, y - 10);
        ctx.stroke();
        
        // Title text
        ctx.font = '24px SpaceMono-Bold';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(title, x + 40, y);
        ctx.restore();
    }

    // New method for drawing grid pattern
    drawGridPattern(ctx, width, height) {
        ctx.strokeStyle = '#9b6dff20';
        ctx.lineWidth = 1;
        const spacing = 30;

        for (let x = 0; x <= width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        for (let y = 0; y <= height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    // New compact stat box design
    drawCompactStatBox(ctx, stat, x, y, width, height) {
        ctx.save();
        
        // Box background
        const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
        gradient.addColorStop(0, '#2a1b3d80');
        gradient.addColorStop(1, '#37254980');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 8);
        ctx.fill();

        // Icon and label
        ctx.font = '18px SpaceMono-Bold';
        ctx.fillStyle = '#9b6dff';
        ctx.fillText(stat.icon, x + 15, y + 30);
        
        ctx.font = '14px SpaceMono';
        ctx.fillStyle = '#c4a1ff';
        ctx.fillText(stat.label, x + 45, y + 30);

        // Value
        ctx.font = '20px SpaceMono-Bold';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(stat.value, x + 15, y + 60);
        
        ctx.restore();
    }
}

module.exports = ProfileCommand; 