const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Command = require('../../structures/Command');

class AssignRoleCommand extends Command {
    constructor() {
        super({
            name: 'assignrole',
            description: 'Create role assignment buttons',
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
                    .setName('create')
                    .setDescription('Create role assignment buttons')
                    .addChannelOption(option =>
                        option
                            .setName('channel')
                            .setDescription('Channel to send role buttons')
                            .setRequired(true)
                    )
                    .addIntegerOption(option =>
                        option
                            .setName('roles')
                            .setDescription('Number of role buttons (max 5)')
                            .setRequired(true)
                            .setMinValue(1)
                            .setMaxValue(5)
                    )
                    .addStringOption(option =>
                        option
                            .setName('message')
                            .setDescription('Message to display above the buttons')
                            .setRequired(true)
                    )
                    .addBooleanOption(option =>
                        option
                            .setName('multiple')
                            .setDescription('Allow users to select multiple roles')
                            .setRequired(true)
                    )
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('done')
                    .setDescription('Finalize role button setup')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('showid')
                    .setDescription('Show all server roles and their IDs')
            );
    }

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'create':
                await this.handleCreate(interaction);
                break;
            case 'done':
                await this.handleDone(interaction);
                break;
            case 'showid':
                await this.handleShowId(interaction);
                break;
        }
    }

    async handleDone(interaction) {
        const setupMessages = Array.from(interaction.client.roleSetups.entries())
            .filter(([, setup]) => !setup.setupComplete);

        if (setupMessages.length === 0) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : No pending role button setups found'
                }],
                ephemeral: true
            });
        }

        for (const [messageId, setup] of setupMessages) {
            if (setup.roles.size !== setup.numRoles) {
                return interaction.reply({
                    embeds: [{
                        color: 0x438BEF,
                        description: '> **Ahjin ♱** : Please configure all role buttons before finalizing'
                    }],
                    ephemeral: true
                });
            }
            setup.setupComplete = true;
        }

        await interaction.reply({
            embeds: [{
                color: 0x438BEF,
                description: '> **Ahjin ♱** : Role button setup completed successfully'
            }],
            ephemeral: true
        });
    }

    async handleShowId(interaction) {
        const roles = interaction.guild.roles.cache
            .sort((a, b) => b.position - a.position) // Sort by position (highest first)
            .map(role => `> ${role.name}: \`${role.id}\``)
            .join('\n');

        await interaction.reply({
            embeds: [{
                color: 0x438BEF,
                description: [
                    '> **Ahjin ♱** : Server Roles and IDs:',
                    '',
                    roles
                ].join('\n')
            }],
            ephemeral: true
        });
    }

    async handleCreate(interaction) {
        const channel = interaction.options.getChannel('channel');
        const numRoles = interaction.options.getInteger('roles');
        const message = interaction.options.getString('message');
        const allowMultiple = interaction.options.getBoolean('multiple');

        // Create initial buttons with default labels
        const rows = [];
        let currentRow = new ActionRowBuilder();
        
        for (let i = 1; i <= numRoles; i++) {
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`role_setup:${i}`)
                    .setLabel(`Role ${i}`)
                    .setStyle(ButtonStyle.Secondary)
            );

            if (i % 5 === 0 || i === numRoles) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
        }

        const embed = new EmbedBuilder()
            .setColor(0x438BEF)
            .setDescription(message);

        const setupMsg = await channel.send({
            embeds: [embed],
            components: rows
        });

        // Store setup state
        interaction.client.roleSetups = interaction.client.roleSetups || new Map();
        interaction.client.roleSetups.set(setupMsg.id, {
            numRoles,
            roles: new Map(),
            setupComplete: false,
            allowMultiple
        });

        await interaction.reply({
            embeds: [{
                color: 0x438BEF,
                description: '> **Ahjin ♱** : Click each button to configure its role and label'
            }],
            ephemeral: true
        });
    }
}

module.exports = AssignRoleCommand; 