const AppealSystem = require('../systems/appealSystem');
const { EmbedBuilder, PermissionFlagsBits, ButtonStyle, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        
        if (!interaction) {
            console.error('Received null interaction');
            return;
        }

        try {
            if (interaction.isButton()) {
                console.log('Button interaction received:', {
                    customId: interaction.customId,
                    isDM: !interaction.guild,
                    userId: interaction.user.id,
                    channelType: interaction.channel?.type || 'unknown',
                    timestamp: new Date().toISOString()
                });
                
                try {
                    if (interaction.customId.startsWith('create_appeal:')) {
                        console.log('Processing appeal button click');
                        await AppealSystem.handleAppealButton(interaction).catch(error => {
                            console.error('Appeal button error:', {
                                error: error.message,
                                stack: error.stack,
                                userId: interaction.user.id
                            });
                            return interaction.reply({
                                embeds: [{
                                    color: 0x438BEF,
                                    description: '> **Ahjin ♱ Protection** : An error occurred processing your request.'
                                }],
                                ephemeral: true
                            }).catch(console.error);
                        });
                    } else if (interaction.customId.startsWith('approve_appeal:') || 
                               interaction.customId.startsWith('deny_appeal:')) {
                        if (!interaction.guild) {
                            throw new Error('This action can only be used in a server');
                        }
                        // Defer the reply immediately to prevent timeout
                        await interaction.deferReply({ ephemeral: true });
                        try {
                            await AppealSystem.handleAppealDecision(interaction, interaction.customId.startsWith('approve_appeal:'));
                        } catch (error) {
                            // Edit the deferred reply instead of creating a new one
                            await interaction.editReply({
                                embeds: [{
                                    color: 0x438BEF,
                                    description: '> **Ahjin ♱ Protection** : An error occurred while processing the appeal decision.'
                                }]
                            }).catch(console.error);
                        }
                    } else if (interaction.customId.startsWith('giveaway_join:')) {
                        const giveawayId = interaction.customId.split(':')[1];
                        const giveaway = interaction.client.giveaways.get(giveawayId);
                        
                        if (!giveaway) {
                            return interaction.reply({
                                embeds: [{
                                    color: 0x438BEF,
                                    description: '> **Ahjin ♱** : This giveaway has ended'
                                }],
                                ephemeral: true
                            });
                        }

                        if (giveaway.participants.has(interaction.user.id)) {
                            giveaway.participants.delete(interaction.user.id);
                        } else {
                            giveaway.participants.add(interaction.user.id);
                        }

                        const message = await interaction.channel.messages.fetch(giveaway.messageId);
                        const embed = EmbedBuilder.from(message.embeds[0])
                            .setDescription(message.embeds[0].description.replace(
                                /> \*\*Participants:\*\* \d+/,
                                `> **Participants:** ${giveaway.participants.size}`
                            ));

                        await message.edit({ embeds: [embed] });
                        
                        await interaction.reply({
                            embeds: [{
                                color: 0x438BEF,
                                description: `> **Ahjin ♱** : You have ${giveaway.participants.has(interaction.user.id) ? 'joined' : 'left'} the giveaway`
                            }],
                            ephemeral: true
                        });
                    } else if (interaction.customId.startsWith('giveaway_end:')) {
                        const giveawayId = interaction.customId.split(':')[1];
                        const giveaway = interaction.client.giveaways.get(giveawayId);
                        
                        if (!giveaway) {
                            return interaction.reply({
                                embeds: [{
                                    color: 0x438BEF,
                                    description: '> **Ahjin ♱** : This giveaway has already ended'
                                }],
                                ephemeral: true
                            });
                        }

                        if (interaction.user.id !== giveaway.hostId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                            return interaction.reply({
                                embeds: [{
                                    color: 0x438BEF,
                                    description: '> **Ahjin ♱** : Only the giveaway host or administrators can end the giveaway'
                                }],
                                ephemeral: true
                            });
                        }

                        await interaction.deferReply({ ephemeral: true });
                        await interaction.client.commands.get('giveaway').endGiveaway(interaction.client, giveawayId);
                        
                        await interaction.editReply({
                            embeds: [{
                                color: 0x438BEF,
                                description: '> **Ahjin ♱** : Giveaway ended successfully'
                            }]
                        });
                    } else if (interaction.customId.startsWith('survival_action:')) {
                        const [, messageId, action] = interaction.customId.split(':');
                        const survivalGame = interaction.client.giveaways.get(`survival_${messageId}`);
                        
                        if (!survivalGame || !survivalGame.game.isActive) {
                            return interaction.reply({
                                embeds: [{
                                    color: 0x438BEF,
                                    description: '> **Ahjin ♱** : No active survival game found'
                                }],
                                ephemeral: true
                            });
                        }

                        await survivalGame.game.handleAction(interaction, action);
                        return;
                    } else if (interaction.customId.startsWith('role_setup:')) {
                        const setupId = interaction.message.id;
                        const roleSetup = interaction.client.roleSetups.get(setupId);
                        
                        if (!roleSetup) {
                            return interaction.reply({
                                embeds: [{
                                    color: 0x438BEF,
                                    description: '> **Ahjin ♱** : Role setup session expired'
                                }],
                                ephemeral: true
                            });
                        }

                        // Create modal for role configuration
                        const modal = new ModalBuilder()
                            .setCustomId(`role_config:${setupId}:${interaction.customId.split(':')[1]}`)
                            .setTitle('Configure Role Button');

                        const roleNameInput = new TextInputBuilder()
                            .setCustomId('roleName')
                            .setLabel('Button Label')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Enter the button label')
                            .setRequired(true);

                        const roleIdInput = new TextInputBuilder()
                            .setCustomId('roleId')
                            .setLabel('Role ID')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Enter the role ID')
                            .setRequired(true);

                        const firstRow = new ActionRowBuilder().addComponents(roleNameInput);
                        const secondRow = new ActionRowBuilder().addComponents(roleIdInput);

                        modal.addComponents(firstRow, secondRow);
                        await interaction.showModal(modal);
                    } else if (interaction.customId.startsWith('role_assign:')) {
                        const roleId = interaction.customId.split(':')[1];
                        const messageId = interaction.message.id;
                        const roleSetup = interaction.client.roleSetups.get(messageId);
                        const role = interaction.guild.roles.cache.get(roleId);
                        
                        if (!role) {
                            return interaction.reply({
                                embeds: [{
                                    color: 0x438BEF,
                                    description: '> **Ahjin ♱** : This role no longer exists'
                                }],
                                ephemeral: true
                            });
                        }

                        try {
                            const member = interaction.member;
                            const hasRole = member.roles.cache.has(roleId);

                            // If user has the role, remove it
                            if (hasRole) {
                                await member.roles.remove(roleId);
                                await interaction.reply({
                                    embeds: [{
                                        color: 0x438BEF,
                                        description: `> **Ahjin ♱** : Removed role ${role.name}`
                                    }],
                                    ephemeral: true
                                });
                                return;
                            }

                            // If multiple roles not allowed, remove any existing setup roles
                            if (!roleSetup.allowMultiple) {
                                const existingRoles = Array.from(roleSetup.roles.values())
                                    .map(r => r.id)
                                    .filter(id => member.roles.cache.has(id));

                                if (existingRoles.length > 0) {
                                    await member.roles.remove(existingRoles);
                                }
                            }

                            // Add the new role
                            await member.roles.add(roleId);
                            await interaction.reply({
                                embeds: [{
                                    color: 0x438BEF,
                                    description: `> **Ahjin ♱** : Added role ${role.name}`
                                }],
                                ephemeral: true
                            });
                        } catch (error) {
                            console.error('Error managing role:', error);
                            await interaction.reply({
                                embeds: [{
                                    color: 0x438BEF,
                                    description: '> **Ahjin ♱** : Failed to manage role. Make sure the bot has proper permissions.'
                                }],
                                ephemeral: true
                            });
                        }
                    }
                } catch (error) {
                    console.error('Button interaction error:', error);
                    await AppealSystem.handleError(interaction);
                }
            } else if (interaction.isModalSubmit()) {
                console.log('Modal submission received:', interaction.customId);
                
                if (interaction.customId.startsWith('appeal_form:')) {
                    await AppealSystem.handleAppealSubmission(interaction);
                } else if (interaction.customId.startsWith('role_config:')) {
                    const [, setupId, buttonIndex] = interaction.customId.split(':');
                    const roleSetup = interaction.client.roleSetups.get(setupId);
                    
                    if (!roleSetup) {
                        return interaction.reply({
                            embeds: [{
                                color: 0x438BEF,
                                description: '> **Ahjin ♱** : Role setup session expired'
                            }],
                            ephemeral: true
                        });
                    }

                    const roleName = interaction.fields.getTextInputValue('roleName');
                    const roleId = interaction.fields.getTextInputValue('roleId');

                    // Store role configuration
                    roleSetup.roles.set(buttonIndex, {
                        name: roleName,
                        id: roleId
                    });

                    // Update button
                    const message = await interaction.message.fetch();
                    const newComponents = [];
                    
                    // Rebuild each action row with new buttons
                    for (const oldRow of message.components) {
                        const newRow = new ActionRowBuilder();
                        const buttons = oldRow.components.map(oldButton => {
                            const button = new ButtonBuilder()
                                .setStyle(oldButton.style);
                                
                            if (oldButton.customId === `role_setup:${buttonIndex}`) {
                                button
                                    .setLabel(roleName)
                                    .setCustomId(`role_assign:${roleId}`)
                                    .setStyle(ButtonStyle.Primary);
                            } else {
                                button
                                    .setLabel(oldButton.label)
                                    .setCustomId(oldButton.customId)
                                    .setStyle(oldButton.style);
                            }
                            
                            return button;
                        });
                        
                        newRow.addComponents(buttons);
                        newComponents.push(newRow);
                    }

                    await message.edit({ components: newComponents });
                    await interaction.reply({
                        embeds: [{
                            color: 0x438BEF,
                            description: '> **Ahjin ♱** : Role button configured successfully'
                        }],
                        ephemeral: true
                    });
                }
            } else if (interaction.isCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) return;

                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(`Error executing command ${interaction.commandName}:`, error);
                    await interaction.reply({
                        embeds: [{
                            color: 0x438BEF,
                            description: '> **Ahjin ♱ Protection** : There was an error executing this command.'
                        }],
                        ephemeral: true
                    }).catch(() => {});
                }
                return;
            }

        } catch (error) {
            console.error('Error handling interaction:', error);
            await AppealSystem.handleError(interaction);
        }
    }
}; 