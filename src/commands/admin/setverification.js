const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const Command = require('../../structures/Command');
const GuildSettings = require('../../models/GuildSettings');

class SetVerificationCommand extends Command {
    constructor() {
        super({
            name: 'setverification',
            description: 'Set up the server verification system',
            category: 'admin',
            userPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    data() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The channel for verification')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            );
    }

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.options.getChannel('channel');
            const guild = interaction.guild;

            // Create or get roles
            const verifiedRole = await this.getOrCreateRole(guild, 'Verified', 0x2ecc71);
            const unverifiedRole = await this.getOrCreateRole(guild, 'Unverified', 0xe74c3c);

            // Set up channel permissions
            await this.setupChannelPermissions(guild, channel, verifiedRole, unverifiedRole);

            // Create verification message
            const verificationEmbed = new EmbedBuilder()
                .setColor(0x438BEF)
                .setTitle('Server Verification')
                .setDescription([
                    '> Welcome to the server! To gain access, please react with ✅ below.',
                    '',
                    '**Instructions:**',
                    '> 1. Read the server rules',
                    '> 2. React with ✅ below',
                    '> 3. Get access to the server',
                    '',
                    '> By verifying, you agree to follow all server rules.'
                ].join('\n'));

            const verificationMsg = await channel.send({ embeds: [verificationEmbed] });
            await verificationMsg.react('✅');

            // Save settings
            await GuildSettings.findOneAndUpdate(
                { guildId: guild.id },
                {
                    verificationEnabled: true,
                    verificationChannel: channel.id,
                    verificationMessage: verificationMsg.id,
                    verifiedRole: verifiedRole.id,
                    unverifiedRole: unverifiedRole.id
                },
                { upsert: true }
            );

            await interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Verification system has been set up successfully!'
                }]
            });

        } catch (error) {
            console.error('Error setting up verification:', error);
            await interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : An error occurred while setting up verification.'
                }]
            });
        }
    }

    async getOrCreateRole(guild, name, color) {
        let role = guild.roles.cache.find(r => r.name === name);
        
        if (!role) {
            role = await guild.roles.create({
                name: name,
                color: color,
                reason: 'Verification system setup'
            });
        }

        return role;
    }

    async setupChannelPermissions(guild, verificationChannel, verifiedRole, unverifiedRole) {
        // Set basic permissions for @everyone (don't remove all permissions)
        await guild.roles.everyone.setPermissions(['ViewChannel', 'ReadMessageHistory']);

        // Set up verification channel permissions
        await verificationChannel.permissionOverwrites.set([
            {
                id: guild.roles.everyone.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                deny: [PermissionFlagsBits.SendMessages]
            },
            {
                id: verifiedRole.id,
                deny: [PermissionFlagsBits.ViewChannel]
            }
        ]);

        // Set up permissions for all other channels
        const channels = guild.channels.cache.filter(c => c.id !== verificationChannel.id);
        
        for (const channel of channels.values()) {
            await channel.permissionOverwrites.set([
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: verifiedRole.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AddReactions,
                        PermissionFlagsBits.Connect,
                        PermissionFlagsBits.Speak
                    ]
                },
                {
                    id: unverifiedRole.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                }
            ]);
        }
    }
}

module.exports = SetVerificationCommand; 