const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Command = require('../../structures/Command');
const GuildSettings = require('../../models/GuildSettings');
const SurvivalGiveaway = require('../../structures/SurvivalGiveaway');

class GiveawayCommand extends Command {
    constructor() {
        super({
            name: 'giveaway',
            description: 'Manage giveaways',
            category: 'admin',
            userPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('config')
                    .setDescription('Configure giveaway settings')
                    .addChannelOption(option =>
                        option
                            .setName('channel')
                            .setDescription('Set the giveaway channel')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('start')
                    .setDescription('Start a new giveaway')
                    .addStringOption(option =>
                        option
                            .setName('prize')
                            .setDescription('What is being given away')
                            .setRequired(true)
                    )
                    .addIntegerOption(option =>
                        option
                            .setName('duration')
                            .setDescription('Duration in minutes')
                            .setRequired(true)
                            .setMinValue(1)
                            .setMaxValue(10080) // 1 week max
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('survival')
                    .setDescription('Start a survival-style giveaway')
                    .addStringOption(option =>
                        option
                            .setName('prize')
                            .setDescription('What is being given away')
                            .setRequired(true)
                    )
                    .addIntegerOption(option =>
                        option
                            .setName('timestart')
                            .setDescription('Time until giveaway starts (in minutes)')
                            .setRequired(true)
                            .setMinValue(1)
                            .setMaxValue(1440) // Max 24 hours
                    )
            );
    }

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'config':
                await this.handleConfig(interaction);
                break;
            case 'start':
                await this.handleStart(interaction);
                break;
            case 'survival':
                await this.handleSurvival(interaction);
                break;
        }
    }

    async handleConfig(interaction) {
        const channel = interaction.options.getChannel('channel');

        try {
            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { giveawayChannel: channel.id },
                { upsert: true }
            );

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : Giveaway channel set to ${channel}`
                }],
                ephemeral: true
            });
        } catch (error) {
            console.error('Error configuring giveaway channel:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to set giveaway channel'
                }],
                ephemeral: true
            });
        }
    }

    async handleStart(interaction) {
        const prize = interaction.options.getString('prize');
        const duration = interaction.options.getInteger('duration');
        
        try {
            const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            if (!settings?.giveawayChannel) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱** : Please configure a giveaway channel first using `/giveaway config`'
                    }],
                    ephemeral: true
                });
            }

            const channel = interaction.guild.channels.cache.get(settings.giveawayChannel);
            if (!channel) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱** : Configured giveaway channel not found'
                    }],
                    ephemeral: true
                });
            }

            const endTime = new Date(Date.now() + duration * 60000);
            const participants = new Set();

            const giveawayEmbed = new EmbedBuilder()
                .setColor(0x438BEF)
                .setTitle('Giveaway Time!')
                .setDescription([
                    `> **Prize:** ${prize}`,
                    `> **Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>`,
                    `> **Hosted by:** ${interaction.user}`,
                    '',
                    '> **Participants:** 0'
                ].join('\n'))

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`giveaway_join:${interaction.id}`)
                        .setLabel('Join')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`giveaway_end:${interaction.id}`)
                        .setLabel('End')
                        .setStyle(ButtonStyle.Danger)
                );

            const message = await channel.send({
                embeds: [giveawayEmbed],
                components: [buttons]
            });

            // Store giveaway data in memory or database
            interaction.client.giveaways.set(interaction.id, {
                messageId: message.id,
                channelId: channel.id,
                endTime,
                prize,
                participants,
                hostId: interaction.user.id
            });

            // Set timeout to end giveaway
            setTimeout(() => this.endGiveaway(interaction.client, interaction.id), duration * 60000);

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : Giveaway started in ${channel}`
                }],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error starting giveaway:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to start giveaway'
                }],
                ephemeral: true
            });
        }
    }

    async handleSurvival(interaction) {
        const prize = interaction.options.getString('prize');
        const timestart = interaction.options.getInteger('timestart');
        
        try {
            const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            if (!settings?.giveawayChannel) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱** : Please configure a giveaway channel first using `/giveaway config`'
                    }],
                    ephemeral: true
                });
            }

            const channel = interaction.guild.channels.cache.get(settings.giveawayChannel);
            if (!channel) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱** : Configured giveaway channel not found'
                    }],
                    ephemeral: true
                });
            }

            const startTime = new Date(Date.now() + timestart * 60000);
            const survivalEmbed = new EmbedBuilder()
                .setColor(0x438BEF)
                .setTitle('🎮 Survival Giveaway')
                .setDescription([
                    `> **Prize:** ${prize}`,
                    `> **Starts:** <t:${Math.floor(startTime.getTime() / 1000)}:R>`,
                    `> **Hosted by:** ${interaction.user}`,
                    '',
                    '**Game Rules**',
                    '> • React with 🎮 to join',
                    '> • Each round lasts 5 seconds',
                    '> • Find items and form alliances',
                    '> • Last survivor wins the prize!',
                    '',
                    '**Game Controls**',
                    '> 🎒 - View/Use Items',
                    '> 📊 - Check Stats',
                    '> 🤝 - Alliance Options',
                    '',
                    '**Participants:** 0'
                ].join('\n'))
                .setFooter({ text: 'Game will start automatically when the timer ends' });

            const message = await channel.send({
                embeds: [survivalEmbed]
            });

            const actionRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`survival_action:${message.id}:inventory`)
                        .setEmoji('🎒')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`survival_action:${message.id}:stats`)
                        .setEmoji('📊')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`survival_action:${message.id}:alliance`)
                        .setEmoji('🤝')
                        .setStyle(ButtonStyle.Secondary)
                );

            await message.edit({
                embeds: [survivalEmbed],
                components: [actionRow]
            });
            await message.react('🎮');

            // Initialize the survival game
            const survivalGame = new SurvivalGiveaway(channel, prize);
            interaction.client.giveaways.set(`survival_${message.id}`, {
                type: 'survival',
                messageId: message.id,
                channelId: channel.id,
                startTime,
                prize,
                game: survivalGame,
                hostId: interaction.user.id
            });

            // Schedule game start
            setTimeout(async () => {
                try {
                    const reactions = await message.reactions.cache.get('🎮').users.fetch();
                    const participants = Array.from(reactions.values()).filter(user => !user.bot);

                    if (participants.length < 2) {
                        await channel.send({
                            embeds: [{
                                color: 0x438BEF,
                                description: '> **Ahjin ♱** : Survival giveaway cancelled - Not enough participants (minimum 2 required)'
                            }]
                        });
                        interaction.client.giveaways.delete(`survival_${message.id}`);
                        return;
                    }

                    // Initialize all participants sequentially
                    for (const user of participants) {
                        await survivalGame.initializePlayer(user);
                    }

                    // Start the game after all players have chosen classes
                    await survivalGame.start();
                } catch (error) {
                    console.error('Error starting survival game:', error);
                    await channel.send({
                        embeds: [{
                            color: 0x438BEF,
                            description: '> **Ahjin ♱** : An error occurred while starting the survival game'
                        }]
                    });
                    interaction.client.giveaways.delete(`survival_${message.id}`);
                }
            }, timestart * 60000);

            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : Survival giveaway will start in ${timestart} minutes in ${channel}`
                }],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error starting survival giveaway:', error);
            await interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Failed to start survival giveaway'
                }],
                ephemeral: true
            });
        }
    }

    async endGiveaway(client, giveawayId) {
        const giveaway = client.giveaways.get(giveawayId);
        if (!giveaway) return;

        const channel = client.channels.cache.get(giveaway.channelId);
        if (!channel) return;

        const message = await channel.messages.fetch(giveaway.messageId);
        if (!message) return;

        const winner = this.selectWinner(Array.from(giveaway.participants));

        const endEmbed = new EmbedBuilder()
            .setColor(0x438BEF)
            .setTitle('🎉 Giveaway Ended!')
            .setDescription([
                `> **Prize:** ${giveaway.prize}`,
                `> **Winner:** ${winner ? `<@${winner}>` : 'No participants'}`,
                `> **Total Participants:** ${giveaway.participants.size}`
            ].join('\n'))
            .setTimestamp();

        await message.edit({
            embeds: [endEmbed],
            components: []
        });

        if (winner) {
            await channel.send({
                content: `Congratulations <@${winner}>! You won **${giveaway.prize}**! `
            });
        }

        client.giveaways.delete(giveawayId);
    }

    async endSurvival(client, survivalId) {
        const survival = client.survivals.get(survivalId);
        if (!survival) return;

        const channel = client.channels.cache.get(survival.channelId);
        if (!channel) return;

        const message = await channel.messages.fetch(survival.messageId);
        if (!message) return;

        const winner = this.selectWinner(Array.from(survival.participants));

        const endEmbed = new EmbedBuilder()
            .setColor(0x438BEF)
            .setTitle('🎉 Survival Ended!')
            .setDescription([
                `> **Prize:** ${survival.prize}`,
                `> **Winner:** ${winner ? `<@${winner}>` : 'No participants'}`,
                `> **Total Participants:** ${survival.participants.size}`
            ].join('\n'))
            .setTimestamp();

        await message.edit({
            embeds: [endEmbed],
            components: []
        });

        if (winner) {
            await channel.send({
                content: `Congratulations <@${winner}>! You won **${survival.prize}**! `
            });
        }

        client.survivals.delete(survivalId);
    }

    selectWinner(participants) {
        if (participants.length === 0) return null;
        return participants[Math.floor(Math.random() * participants.length)];
    }
}

module.exports = GiveawayCommand; 