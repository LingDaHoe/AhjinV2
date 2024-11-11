const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

class SurvivalGiveaway {
    constructor(channel, prize) {
        this.channel = channel;
        this.prize = prize;
        this.participants = new Map();
        this.isActive = false;
        this.round = 0;
        this.stats = new Map();
        this.inventory = new Map();
        this.alliances = new Map();
        this.classes = new Map(); // New: Player classes

        // Enhanced game constants
        this.ROUND_DURATION = 30000; // 30 seconds per round
        this.BASE_DAMAGE = 15;
        this.CRITICAL_CHANCE = 0.2;
        this.HEAL_AMOUNT = 25;

        this.initializeGameElements();
    }

    initializeGameElements() {
        // Enhanced items with class requirements and special effects
        this.items = {
            weapons: [
                { name: '⚔️ Excalibur', power: 90, rarity: 'legendary', class: 'warrior', effect: 'double_damage' },
                { name: '🏹 Artemis Bow', power: 75, rarity: 'epic', class: 'archer', effect: 'poison' },
                { name: '🔮 Mystic Staff', power: 85, rarity: 'legendary', class: 'mage', effect: 'mana_burn' },
                { name: '🗡️ Shadow Blade', power: 70, rarity: 'epic', class: 'rogue', effect: 'stealth' }
            ],
            armor: [
                { name: '🛡️ Holy Aegis', defense: 85, rarity: 'legendary', class: 'warrior', effect: 'reflect_damage' },
                { name: '🦊 Fox Cloak', defense: 65, rarity: 'epic', class: 'rogue', effect: 'dodge' },
                { name: '✨ Ethereal Robe', defense: 75, rarity: 'epic', class: 'mage', effect: 'spell_shield' }
            ],
            artifacts: [
                { name: '💎 Dragon Heart', effect: 'regeneration', rarity: 'legendary', boost: 'health' },
                { name: '⚡ Thunder Essence', effect: 'chain_lightning', rarity: 'epic', boost: 'damage' },
                { name: '🌟 Angel\'s Blessing', effect: 'revive', rarity: 'legendary', boost: 'all' }
            ]
        };

        // Enhanced events with class-specific outcomes
        this.events = [
            { type: 'duel', text: '⚔️ challenged to a duel by', damage: true, chance: 0.25 },
            { type: 'ambush', text: '🗡️ got ambushed by', damage: true, chance: 0.2 },
            { type: 'blessing', text: '✨ received a divine blessing', heal: true, chance: 0.15 },
            { type: 'treasure', text: '🎁 discovered an ancient treasure', reward: true, chance: 0.2 },
            { type: 'betrayal', text: '💔 was betrayed by their ally', damage: true, chance: 0.1 },
            { type: 'quest', text: '📜 completed a legendary quest', reward: true, chance: 0.1 }
        ];

        // New: Character classes
        this.characterClasses = {
            warrior: { emoji: '⚔️', bonus: 'defense', special: 'berserk' },
            mage: { emoji: '🔮', bonus: 'magic', special: 'teleport' },
            archer: { emoji: '🏹', bonus: 'critical', special: 'multishot' },
            rogue: { emoji: '🗡️', bonus: 'dodge', special: 'assassinate' }
        };
    }

    async initializePlayer(user) {
        // Initialize base stats with class bonuses
        const classSelection = await this.promptClassSelection(user);
        const selectedClass = this.characterClasses[classSelection];

        const baseStats = {
            health: 100,
            energy: 100,
            kills: 0,
            class: classSelection,
            specialUses: 2, // Number of times special ability can be used
            effects: [] // Active effects (poison, blessing, etc.)
        };

        // Apply class-specific bonuses
        switch (classSelection) {
            case 'warrior':
                baseStats.health += 25;
                break;
            case 'mage':
                baseStats.energy += 25;
                break;
            case 'archer':
                baseStats.critical_chance = 0.25;
                break;
            case 'rogue':
                baseStats.dodge_chance = 0.2;
                break;
        }

        this.stats.set(user.id, baseStats);
        this.inventory.set(user.id, []);
        this.participants.set(user.id, user);

        // Give starter equipment based on class
        const starterKit = this.getStarterKit(classSelection);
        this.inventory.get(user.id).push(...starterKit);

        await this.channel.send({
            embeds: [{
                color: 0x438BEF,
                description: [
                    `> **Ahjin ♱** : ${user} has chosen the path of ${selectedClass.emoji} **${classSelection}**!`,
                    '',
                    '**Starting Equipment**',
                    ...starterKit.map(item => `> ${item.name}`),
                    '',
                    '**Class Bonus**',
                    `> ${this.getClassBonus(classSelection)}`
                ].join('\n')
            }]
        });
    }

    async promptClassSelection(user) {
        const classEmbed = new EmbedBuilder()
            .setColor(0x438BEF)
            .setTitle('⚔️ Choose Your Class')
            .setDescription([
                '> Select your class for the survival game:',
                '',
                '**Available Classes**',
                '> ⚔️ Warrior - Tank specialist with high defense',
                '> 🔮 Mage - Master of magical abilities',
                '> 🏹 Archer - Ranged expert with critical strikes',
                '> 🗡️ Rogue - Stealth specialist with high evasion',
                '',
                '> React with the corresponding emoji to choose your class!'
            ].join('\n'));

        const classMsg = await this.channel.send({
            content: `<@${user.id}>`,
            embeds: [classEmbed]
        });

        for (const classData of Object.values(this.characterClasses)) {
            await classMsg.react(classData.emoji);
        }

        try {
            const filter = (reaction, u) => 
                u.id === user.id && 
                Object.values(this.characterClasses).some(c => c.emoji === reaction.emoji.name);

            const collected = await classMsg.awaitReactions({
                filter,
                max: 1,
                time: 30000,
                errors: ['time']
            });

            const choice = collected.first().emoji.name;
            await classMsg.delete().catch(() => {});

            return Object.entries(this.characterClasses)
                .find(([, data]) => data.emoji === choice)[0];
        } catch (error) {
            await classMsg.delete().catch(() => {});
            return 'warrior'; // Default to warrior if no selection made
        }
    }

    getStarterKit(className) {
        const starterKits = {
            warrior: [
                { name: '⚔️ Iron Sword', power: 40, rarity: 'common', class: 'warrior' },
                { name: '🛡️ Iron Shield', defense: 30, rarity: 'common', class: 'warrior' }
            ],
            mage: [
                { name: '🔮 Apprentice Staff', power: 45, rarity: 'common', class: 'mage' },
                { name: '📚 Spellbook', effect: 'mana_regen', rarity: 'common', class: 'mage' }
            ],
            archer: [
                { name: '🏹 Hunting Bow', power: 35, rarity: 'common', class: 'archer' },
                { name: '🎯 Quiver', effect: 'extra_arrows', rarity: 'common', class: 'archer' }
            ],
            rogue: [
                { name: '🗡️ Steel Dagger', power: 30, rarity: 'common', class: 'rogue' },
                { name: '🌫️ Smoke Bomb', effect: 'stealth', rarity: 'common', class: 'rogue' }
            ]
        };

        return starterKits[className];
    }

    getClassBonus(className) {
        const bonuses = {
            warrior: '+25 Health, Damage Reflection',
            mage: '+25 Energy, Spell Shield',
            archer: '+25% Critical Strike Chance',
            rogue: '+20% Dodge Chance'
        };

        return bonuses[className];
    }

    async start() {
        if (this.participants.size < 2) return false;
        
        this.isActive = true;
        await this.channel.send({
            embeds: [{
                color: 0x438BEF,
                description: '> **Ahjin ♱** : The survival game has begun! May the odds be in your favor!'
            }]
        });

        // Create action buttons with message ID
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`survival_action:inventory`)
                    .setEmoji('🎒')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`survival_action:stats`)
                    .setEmoji('📊')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`survival_action:alliance`)
                    .setEmoji('🤝')
                    .setStyle(ButtonStyle.Secondary)
            );

        await this.channel.send({
            content: '**Game Controls**',
            components: [actionRow]
        });

        // Start first round immediately
        this.round = 1;
        await this.processRound();
        
        // Start game loop
        this.gameLoop();
        return true;
    }

    async gameLoop() {
        while (this.isActive && this.getLivingParticipants().length > 1) {
            // Wait between rounds
            await new Promise(resolve => setTimeout(resolve, this.ROUND_DURATION));
            
            // Process next round
            this.round++;
            await this.processRound();
            
            // Update game status
            await this.channel.send({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : Round ${this.round} has ended. ${this.getLivingParticipants().length} survivors remain.`
                }]
            });
        }

        await this.endGame();
    }

    getLivingParticipants() {
        return Array.from(this.participants.values())
            .filter(user => this.stats.get(user.id).health > 0);
    }

    async processRound() {
        const survivors = this.getLivingParticipants();
        
        // Process alliances first
        for (const alliance of this.alliances.values()) {
            // Check for potential betrayals
            if (Math.random() < 0.2 * this.round / 10) { // Increasing chance as rounds progress
                const betrayer = alliance.members[Math.floor(Math.random() * 2)];
                await this.triggerBetrayal({ id: betrayer });
            }
            
            // Process alliance synergy effects
            for (const memberId of alliance.members) {
                const stats = this.stats.get(memberId);
                if (stats && stats.health > 0) {
                    const synergyBonus = Math.floor(alliance.synergy.value * 10);
                    stats.health = Math.min(100, stats.health + synergyBonus);
                    stats.energy = Math.min(100, stats.energy + synergyBonus);
                }
            }
        }

        // Enhanced round embed with alliance info
        const roundEmbed = new EmbedBuilder()
            .setColor(0x438BEF)
            .setDescription([
                `> **Round ${this.round}**`,
                `> **Prize:** ${this.prize}`,
                `> **Survivors:** ${survivors.length}`,
                '',
                '**Current Status**',
                ...survivors.map(player => {
                    const stats = this.stats.get(player.id);
                    const alliance = Array.from(this.alliances.values())
                        .find(a => a.members.includes(player.id));
                    const allianceInfo = alliance ? 
                        ` 🤝${this.participants.get(alliance.members.find(id => id !== player.id))}` : '';
                    
                    return `> ${player} ${this.characterClasses[stats.class].emoji} ❤️${stats.health} ⚡${stats.energy} 💀${stats.kills}${allianceInfo}`;
                }),
                '',
                '**Active Alliances**',
                ...Array.from(this.alliances.values()).map(alliance => {
                    const [p1, p2] = alliance.members.map(id => this.participants.get(id));
                    return `> 🤝 ${p1} & ${p2} (${Math.floor(alliance.synergy.value * 100)}% synergy)`;
                })
            ].join('\n'));

        await this.channel.send({ embeds: [roundEmbed] });

        // Process events for each survivor
        for (const player of survivors) {
            if (Math.random() < 0.7) {
                await this.processRandomEvent(player);
            }
        }

        // Check for game end condition
        if (survivors.length <= 1) {
            this.isActive = false;
        }
    }

    async processRandomEvent(player) {
        const event = this.selectRandomEvent();
        const stats = this.stats.get(player.id);
        const playerClass = stats.class;

        // Class-specific event modifications
        const eventModifiers = {
            warrior: { damage: 0.8, heal: 1.2 },
            mage: { damage: 1.2, heal: 1.1 },
            archer: { damage: 1.1, heal: 0.9 },
            rogue: { damage: 1.3, heal: 0.8 }
        };

        const modifier = eventModifiers[playerClass];
        let eventResult = [];

        switch (event.type) {
            case 'duel':
                const opponent = this.selectRandomOpponent(player);
                if (opponent) {
                    if (Math.random() < 0.2) { // 20% chance to use special ability in duel
                        await this.processSpecialAbility(player, opponent);
                    } else {
                        await this.processCombat(player, opponent);
                    }
                }
                break;

            case 'ambush':
                const ambusher = this.selectRandomOpponent(player);
                if (ambusher) {
                    if (playerClass === 'rogue' && Math.random() < 0.4) {
                        eventResult.push('> dodged the ambush and counter-attacked!');
                        await this.processCombat(player, ambusher);
                    } else {
                        const damage = Math.floor(this.BASE_DAMAGE * 1.5 * modifier.damage);
                        stats.health = Math.max(0, stats.health - damage);
                        eventResult.push(`> got ambushed and took **${damage}** damage!`);
                    }
                }
                break;

            case 'blessing':
                const healAmount = Math.floor(this.HEAL_AMOUNT * modifier.heal);
                stats.health = Math.min(100, stats.health + healAmount);
                stats.energy = Math.min(100, stats.energy + 20);
                
                if (playerClass === 'mage') {
                    stats.specialUses = Math.min(2, stats.specialUses + 1);
                    eventResult.push('> restored 1 special ability use!');
                }
                
                eventResult.push(`> recovered **${healAmount}** health and **20** energy!`);
                break;

            case 'treasure':
                const item = this.generateClassSpecificItem(playerClass);
                this.inventory.get(player.id).push(item);
                eventResult.push(`> found ${item.name}!`);
                break;
        }

        if (eventResult.length > 0) {
            await this.channel.send({
                embeds: [{
                    color: 0x438BEF,
                    description: [
                        `> **Ahjin ♱** : ${player} ${event.text}`,
                        ...eventResult
                    ].join('\n')
                }]
            });
        }

        this.stats.set(player.id, stats);
    }

    async processCombat(attacker, defender) {
        const attackerStats = this.stats.get(attacker.id);
        const defenderStats = this.stats.get(defender.id);
        const attackerClass = attackerStats.class;
        const defenderClass = defenderStats.class;

        // Calculate base damage
        let damage = this.BASE_DAMAGE;
        let isCritical = false;
        let isDodged = false;

        // Apply weapon damage from inventory
        const weapon = this.inventory.get(attacker.id).find(item => item.power);
        if (weapon) {
            damage += weapon.power * 0.1;
        }

        // Apply class-specific modifiers
        switch (attackerClass) {
            case 'warrior':
                damage *= 1.2;
                break;
            case 'archer':
                isCritical = Math.random() < (attackerStats.critical_chance || this.CRITICAL_CHANCE);
                if (isCritical) damage *= 2;
                break;
            case 'mage':
                if (attackerStats.energy >= 20) {
                    damage *= 1.5;
                    attackerStats.energy -= 20;
                }
                break;
            case 'rogue':
                if (attackerStats.effects.some(e => e.type === 'stealth')) {
                    damage *= 1.8;
                }
                break;
        }

        // Apply defender's defensive mechanics
        isDodged = Math.random() < (defenderStats.dodge_chance || 0);
        if (!isDodged) {
            // Apply armor reduction
            const armor = this.inventory.get(defender.id).find(item => item.defense);
            if (armor) {
                damage *= (1 - armor.defense * 0.001);
            }

            // Apply class-specific defense
            switch (defenderClass) {
                case 'warrior':
                    if (defenderStats.effects.some(e => e.type === 'fortify')) {
                        damage *= 0.6;
                    }
                    break;
                case 'mage':
                    if (defenderStats.effects.some(e => e.type === 'spell_shield')) {
                        damage *= 0.7;
                    }
                    break;
            }

            // Apply final damage
            defenderStats.health = Math.max(0, defenderStats.health - Math.floor(damage));

            // Process post-damage effects
            if (defenderClass === 'warrior' && defenderStats.effects.some(e => e.type === 'reflect_damage')) {
                attackerStats.health -= Math.floor(damage * 0.3);
            }
        }

        // Generate combat message
        const combatResult = [];
        combatResult.push(`> **Ahjin ♱** : ${attacker} attacks ${defender}!`);
        
        if (isDodged) {
            combatResult.push(`> ${defender} dodged the attack!`);
        } else {
            combatResult.push(
                `> Dealt **${Math.floor(damage)}** damage${isCritical ? ' (CRITICAL STRIKE!)' : ''}`,
                `> ${defender}'s remaining health: **${Math.max(0, defenderStats.health)}**`
            );
        }

        await this.channel.send({
            embeds: [{
                color: 0x438BEF,
                description: combatResult.join('\n')
            }]
        });

        // Update stats
        this.stats.set(attacker.id, attackerStats);
        this.stats.set(defender.id, defenderStats);

        // Check for elimination
        if (defenderStats.health <= 0) {
            attackerStats.kills++;
            await this.eliminatePlayer(defender);
        }
    }

    async processSpecialAbility(attacker, target) {
        const attackerStats = this.stats.get(attacker.id);
        const targetStats = this.stats.get(target.id);

        if (attackerStats.specialUses <= 0) {
            return {
                success: false,
                message: '> **Ahjin ♱** : No special ability uses remaining'
            };
        }

        let damage = this.BASE_DAMAGE * 2;
        let effectDescription = '';

        switch (attackerStats.class) {
            case 'warrior':
                // Berserk: Double damage but take 25% of damage dealt
                damage *= 2;
                attackerStats.health -= Math.floor(damage * 0.25);
                effectDescription = `enters a berserker rage and deals **${damage}** damage!`;
                targetStats.health -= damage;
                break;

            case 'mage':
                // Teleport: Escape from combat and heal
                if (Math.random() < 0.8) {
                    attackerStats.health = Math.min(100, attackerStats.health + this.HEAL_AMOUNT);
                    attackerStats.effects.push({ type: 'spell_shield', duration: 2 });
                    effectDescription = 'teleports to safety and recovers health!';
                } else {
                    effectDescription = 'failed to teleport!';
                }
                break;

            case 'archer':
                // Multishot: Hit multiple targets with reduced damage
                const targets = this.getLivingParticipants()
                    .filter(p => p.id !== attacker.id)
                    .slice(0, 3);
                
                for (const t of targets) {
                    const tStats = this.stats.get(t.id);
                    tStats.health -= Math.floor(damage * 0.6);
                    this.stats.set(t.id, tStats);
                }
                effectDescription = `fires a volley of arrows, hitting ${targets.length} targets!`;
                break;

            case 'rogue':
                // Assassinate: High damage with chance to instantly eliminate low HP target
                if (targetStats.health < 30) {
                    targetStats.health = 0;
                    effectDescription = 'executes a lethal assassination!';
                } else {
                    damage *= 1.5;
                    targetStats.health -= damage;
                    effectDescription = `strikes from the shadows for **${damage}** damage!`;
                }
                attackerStats.effects.push({ type: 'stealth', duration: 1 });
                break;
        }

        attackerStats.specialUses--;
        this.stats.set(attacker.id, attackerStats);
        this.stats.set(target.id, targetStats);

        await this.channel.send({
            embeds: [{
                color: 0x438BEF,
                description: [
                    `> **Ahjin ♱** : ${attacker} ${effectDescription}`,
                    `> Special ability uses remaining: ${attackerStats.specialUses}`
                ].join('\n')
            }]
        });

        // Check for eliminations
        if (targetStats.health <= 0) {
            attackerStats.kills++;
            await this.eliminatePlayer(target);
        }

        return { success: true };
    }

    async endGame() {
        const winner = this.getLivingParticipants()[0];
        const winnerStats = winner ? this.stats.get(winner.id) : null;

        const endEmbed = new EmbedBuilder()
            .setColor(0x438BEF)
            .setTitle('🎮 Survival Giveaway Ended!')
            .setDescription([
                `> **Prize:** ${this.prize}`,
                `> **Winner:** ${winner || 'No winner'}`,
                '',
                winnerStats ? [
                    '**Winner Stats**',
                    `> Health: ${winnerStats.health}`,
                    `> Kills: ${winnerStats.kills}`
                ].join('\n') : '',
                '',
                '> **Ahjin ♱** : Thanks for participating!'
            ].join('\n'));

        await this.channel.send({ embeds: [endEmbed] });
    }

    selectRandomEvent() {
        const roll = Math.random();
        let cumulativeChance = 0;
        
        for (const event of this.events) {
            cumulativeChance += event.chance;
            if (roll < cumulativeChance) return event;
        }
        
        return this.events[0]; // Default to combat if no event is selected
    }

    giveRandomItem(player) {
        const itemTypes = Object.keys(this.items);
        const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        const itemPool = this.items[type];
        const item = itemPool[Math.floor(Math.random() * itemPool.length)];
        
        const inventory = this.inventory.get(player.id);
        inventory.push(item);
        
        return item;
    }

    getBestWeapon(player) {
        const inventory = this.inventory.get(player.id);
        const weapons = inventory.filter(item => 'power' in item);
        return weapons.sort((a, b) => b.power - a.power)[0];
    }

    async eliminatePlayer(player) {
        const stats = this.stats.get(player.id);
        stats.health = 0;
        
        await this.channel.send({
            embeds: [{
                color: 0x438BEF,
                description: `> **Ahjin ♱** : ☠️ ${player} has been eliminated! (${stats.kills} kills)`
            }]
        });
    }

    async useSpecialAbility(player, target) {
        const stats = this.stats.get(player.id);
        if (stats.specialUses <= 0) {
            return false;
        }

        const abilities = {
            warrior: async () => {
                stats.effects.push({ type: 'berserk', duration: 2, bonus: 2.0 });
                await this.channel.send({
                    embeds: [{
                        color: 0x438BEF,
                        description: `> **Ahjin ♱** : ⚔️ ${player} enters a berserker rage! (Double damage for 2 rounds)`
                    }]
                });
            },
            mage: async () => {
                const targetStats = this.stats.get(target.id);
                targetStats.energy = Math.max(0, targetStats.energy - 50);
                await this.channel.send({
                    embeds: [{
                        color: 0x438BEF,
                        description: `> **Ahjin ♱** : 🔮 ${player} drains ${target}'s energy!`
                    }]
                });
            },
            archer: async () => {
                const targets = this.getLivingParticipants()
                    .filter(p => p.id !== player.id)
                    .slice(0, 3);
                
                for (const t of targets) {
                    const damage = Math.floor(this.BASE_DAMAGE * 0.6);
                    this.stats.get(t.id).health -= damage;
                }
                
                await this.channel.send({
                    embeds: [{
                        color: 0x438BEF,
                        description: `> **Ahjin ♱** : 🏹 ${player} unleashes a volley of arrows!`
                    }]
                });
            },
            rogue: async () => {
                const targetStats = this.stats.get(target.id);
                const damage = this.BASE_DAMAGE * 2;
                targetStats.health = Math.max(0, targetStats.health - damage);
                
                await this.channel.send({
                    embeds: [{
                        color: 0x438BEF,
                        description: `> **Ahjin ♱** : 🗡️ ${player} executes a deadly assassination strike!`
                    }]
                });
            }
        };

        await abilities[stats.class]();
        stats.specialUses--;
        return true;
    }

    async createStatusUI(player) {
        const stats = this.stats.get(player.id);
        const inventory = this.inventory.get(player.id);
        const playerClass = this.characterClasses[stats.class];
        const allies = this.getAlliances(player);

        const statusEmbed = new EmbedBuilder()
            .setColor(0x438BEF)
            .setTitle(`${playerClass.emoji} ${player.username}'s Status`)
            .setDescription([
                '**Stats**',
                `> ❤️ Health: ${stats.health}/100`,
                `> ⚡ Energy: ${stats.energy}/100`,
                `> 💀 Kills: ${stats.kills}`,
                '',
                '**Active Effects**',
                stats.effects.length ? stats.effects.map(effect => 
                    `> • ${this.getEffectEmoji(effect.type)} ${effect.type} (${effect.duration} rounds)`
                ).join('\n') : '> None',
                '',
                '**Equipment**',
                inventory.length ? inventory.map(item => 
                    `> ${item.name} (${item.rarity})`
                ).join('\n') : '> None',
                '',
                '**Alliances**',
                allies.length ? allies.map(ally => 
                    `> 🤝 ${ally.username}`
                ).join('\n') : '> None'
            ].join('\n'));

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`use_item:${player.id}`)
                    .setLabel('Use Item')
                    .setEmoji('🎒')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!inventory.length),
                new ButtonBuilder()
                    .setCustomId(`special_ability:${player.id}`)
                    .setLabel(`Use ${playerClass.special}`)
                    .setEmoji(playerClass.emoji)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(stats.specialUses <= 0)
            );

        return { embeds: [statusEmbed], components: [actionRow] };
    }

    async createAllianceUI(player) {
        const survivors = this.getLivingParticipants().filter(p => p.id !== player.id);
        const currentAllies = this.getAlliances(player);

        const allianceEmbed = new EmbedBuilder()
            .setColor(0x438BEF)
            .setTitle('🤝 Alliance Management')
            .setDescription([
                '**Current Allies**',
                currentAllies.length ? currentAllies.map(ally => 
                    `> 🤝 ${ally.username}`
                ).join('\n') : '> None',
                '',
                '**Available Players**',
                survivors.filter(s => !currentAllies.includes(s))
                    .map(s => `> ${s.username}`)
                    .join('\n') || '> None'
            ].join('\n'));

        const rows = [];
        if (survivors.length) {
            const allianceRow = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`form_alliance:${player.id}`)
                        .setPlaceholder('Form Alliance With...')
                        .addOptions(
                            survivors.filter(s => !currentAllies.includes(s))
                                .map(s => ({
                                    label: s.username,
                                    value: s.id,
                                    emoji: '🤝'
                                }))
                        )
                );
            rows.push(allianceRow);
        }

        if (currentAllies.length) {
            const breakRow = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`break_alliance:${player.id}`)
                        .setPlaceholder('Break Alliance With...')
                        .addOptions(
                            currentAllies.map(ally => ({
                                label: ally.username,
                                value: ally.id,
                                emoji: '💔'
                            }))
                        )
                );
            rows.push(breakRow);
        }

        return { embeds: [allianceEmbed], components: rows };
    }

    getEffectEmoji(effectType) {
        const effectEmojis = {
            regeneration: '💖',
            poison: '☠️',
            berserk: '😡',
            stealth: '🌫️',
            spellShield: '🛡️',
            chainLightning: '⚡',
            dodge: '💨',
            strength: '💪'
        };
        return effectEmojis[effectType] || '🔮';
    }

    async handleInteraction(interaction) {
        const [action, playerId] = interaction.customId.split(':');
        const player = this.participants.get(playerId);
        
        if (!player || this.stats.get(playerId).health <= 0) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : You are not an active participant in this game'
                }],
                ephemeral: true
            });
        }

        switch (action) {
            case 'use_item':
                await this.handleItemUse(interaction, player);
                break;
            case 'special_ability':
                await this.handleSpecialAbility(interaction, player);
                break;
            case 'form_alliance':
                await this.handleAllianceFormation(interaction, player);
                break;
            case 'break_alliance':
                await this.handleAllianceBreak(interaction, player);
                break;
        }
    }

    async handleItemUse(interaction, itemIndex) {
        const playerStats = this.stats.get(interaction.user.id);
        const inventory = this.inventory.get(interaction.user.id);
        
        if (itemIndex < 0 || itemIndex >= inventory.length) {
            return interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Invalid item selection'
                }]
            });
        }

        const item = inventory[itemIndex];
        let effectDescription = '';
        let success = true;

        // Check class requirements
        if (item.class && item.class !== playerStats.class) {
            return interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : This item can only be used by ${item.class} class`
                }]
            });
        }

        // Process item effects
        switch (item.effect) {
            case 'double_damage':
                playerStats.effects.push({ type: 'double_damage', duration: 2 });
                effectDescription = 'doubled damage for 2 rounds';
                break;
                
            case 'poison':
                const target = await this.selectTarget(interaction);
                if (target) {
                    const targetStats = this.stats.get(target.id);
                    targetStats.effects.push({ type: 'poison', duration: 3, damage: 10 });
                    this.stats.set(target.id, targetStats);
                    effectDescription = `poisoned ${target}`;
                } else {
                    success = false;
                }
                break;

            case 'mana_burn':
                playerStats.energy = Math.min(100, playerStats.energy + 50);
                playerStats.specialUses = Math.min(2, playerStats.specialUses + 1);
                effectDescription = 'restored energy and special ability use';
                break;

            case 'stealth':
                playerStats.effects.push({ 
                    type: 'stealth', 
                    duration: item.duration || 2,
                    bonus: playerStats.class === 'rogue' ? 0.4 : 0.2 
                });
                effectDescription = `entered stealth for ${item.duration || 2} rounds`;
                break;

            case 'regeneration':
                playerStats.health = Math.min(100, playerStats.health + 40);
                effectDescription = 'restored 40 health';
                break;

            case 'spell_shield':
                playerStats.effects.push({ type: 'spell_shield', duration: 3 });
                effectDescription = 'gained spell shield for 3 rounds';
                break;

            default:
                if (item.power) {
                    playerStats.effects.push({ 
                        type: 'weapon_boost', 
                        duration: 3,
                        power: item.power 
                    });
                    effectDescription = `equipped ${item.name}`;
                } else if (item.defense) {
                    playerStats.effects.push({ 
                        type: 'armor_boost', 
                        duration: 3,
                        defense: item.defense 
                    });
                    effectDescription = `equipped ${item.name}`;
                }
        }

        if (success) {
            // Remove used item
            inventory.splice(itemIndex, 1);
            this.stats.set(interaction.user.id, playerStats);
            this.inventory.set(interaction.user.id, inventory);

            await this.channel.send({
                embeds: [{
                    color: 0x438BEF,
                    description: [
                        `> **Ahjin ♱** : ${interaction.user} used ${item.name}!`,
                        `> Effect: ${effectDescription}`
                    ].join('\n')
                }]
            });
        }

        return interaction.editReply({
            embeds: [{
                color: 0x438BEF,
                description: success ? 
                    '> **Ahjin ♱** : Item used successfully' : 
                    '> **Ahjin ♱** : Failed to use item'
            }]
        });
    }

    async handleSpecialAbility(interaction, player) {
        const stats = this.stats.get(player.id);
        if (stats.specialUses <= 0) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : You have no special ability uses remaining'
                }],
                ephemeral: true
            });
        }

        const survivors = this.getLivingParticipants().filter(p => p.id !== player.id);
        if (!survivors.length) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : No valid targets available'
                }],
                ephemeral: true
            });
        }

        const targetSelect = new StringSelectMenuBuilder()
            .setCustomId(`special_ability_target:${player.id}`)
            .setPlaceholder('Select your target')
            .addOptions(
                survivors.map(target => ({
                    label: target.username,
                    value: target.id,
                    emoji: this.characterClasses[this.stats.get(target.id).class].emoji
                }))
            );

        await interaction.reply({
            embeds: [{
                color: 0x438BEF,
                title: `${this.characterClasses[stats.class].emoji} Special Ability`,
                description: `Choose a target for your ${this.characterClasses[stats.class].special} ability`
            }],
            components: [new ActionRowBuilder().addComponents(targetSelect)],
            ephemeral: true
        });
    }

    async handleItemSelect(interaction) {
        const [, playerId] = interaction.customId.split(':');
        const player = this.participants.get(playerId);
        const inventory = this.inventory.get(playerId);
        const selectedItem = inventory[parseInt(interaction.values[0])];

        if (!selectedItem) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : Invalid item selection'
                }]
            });
        }

        // Handle item effects
        const stats = this.stats.get(playerId);
        let effectDescription = '';

        switch (selectedItem.effect) {
            case 'regeneration':
                stats.health = Math.min(100, stats.health + selectedItem.heal || 30);
                effectDescription = `restored ${selectedItem.heal || 30} health`;
                break;
            case 'mana_burn':
                const targets = this.getLivingParticipants()
                    .filter(p => p.id !== playerId);
                for (const target of targets) {
                    this.stats.get(target.id).energy = Math.max(0, this.stats.get(target.id).energy - 20);
                }
                effectDescription = 'burned enemy energy';
                break;
            case 'stealth':
                stats.effects.push({ type: 'stealth', duration: 2 });
                effectDescription = 'gained stealth for 2 rounds';
                break;
            case 'chain_lightning':
                const lightningTargets = this.getLivingParticipants()
                    .filter(p => p.id !== playerId)
                    .slice(0, 3);
                for (const target of lightningTargets) {
                    this.stats.get(target.id).health -= 25;
                }
                effectDescription = `struck ${lightningTargets.length} enemies with lightning`;
                break;
        }

        // Remove used item
        inventory.splice(parseInt(interaction.values[0]), 1);

        await interaction.reply({
            embeds: [{
                color: 0x438BEF,
                description: [
                    `> **Ahjin ♱** : ${player} used ${selectedItem.name}!`,
                    `> Effect: ${effectDescription}`
                ].join('\n')
            }]
        });

        // Check for eliminations
        await this.checkEliminations();
    }

    async handleSpecialAbilityTarget(interaction) {
        const [, playerId] = interaction.customId.split(':');
        const player = this.participants.get(playerId);
        const targetId = interaction.values[0];
        const target = this.participants.get(targetId);
        const stats = this.stats.get(playerId);

        if (stats.specialUses <= 0) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : No special ability uses remaining'
                }],
                ephemeral: true
            });
        }

        await this.useSpecialAbility(player, target);
        await interaction.reply({
            embeds: [{
                color: 0x438BEF,
                description: `> **Ahjin ♱** : ${player} used their special ability on ${target}!`
            }]
        });

        // Check for eliminations
        await this.checkEliminations();
    }

    async checkEliminations() {
        const eliminated = Array.from(this.participants.values())
            .filter(player => {
                const stats = this.stats.get(player.id);
                return stats && stats.health <= 0;
            });

        for (const player of eliminated) {
            await this.eliminatePlayer(player);
        }
    }

    async handleAllianceAction(interaction, action) {
        switch (action) {
            case 'view':
                await this.displayAllianceStatus(interaction);
                break;

            case 'form':
                await this.handleAllianceFormation(interaction);
                break;

            case 'combine_ability':
                const alliance = Array.from(this.alliances.values())
                    .find(a => a.members.includes(interaction.user.id));
                
                if (alliance) {
                    await this.useCombinedAbility(alliance);
                }
                break;

            case 'leave':
                await this.handleAllianceLeave(interaction);
                break;
        }
    }

    async handleAllianceLeave(interaction) {
        const alliance = Array.from(this.alliances.values())
            .find(a => a.members.includes(interaction.user.id));

        if (!alliance) {
            return interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : You are not in an alliance'
                }]
            });
        }

        // Trigger potential betrayal event
        if (Math.random() < 0.3) {
            await this.triggerBetrayal({ id: interaction.user.id });
        } else {
            this.alliances.delete(alliance.id);
            await this.channel.send({
                embeds: [{
                    color: 0x438BEF,
                    description: `> **Ahjin ♱** : ${interaction.user} has left their alliance`
                }]
            });
        }
    }

    async displayAllianceStatus(interaction) {
        const alliance = Array.from(this.alliances.values())
            .find(a => a.members.includes(interaction.user.id));

        if (!alliance) {
            return interaction.editReply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : You are not in an alliance'
                }]
            });
        }

        const allyId = alliance.members.find(id => id !== interaction.user.id);
        const playerStats = this.stats.get(interaction.user.id);
        const allyStats = this.stats.get(allyId);
        const ally = this.participants.get(allyId);

        const allianceEmbed = new EmbedBuilder()
            .setColor(0x438BEF)
            .setTitle('🤝 Alliance Status')
            .setDescription([
                `> **Alliance Type:** ${this.calculateAllianceSynergy(playerStats.class, allyStats.class).name}`,
                `> **Synergy Level:** ${Math.floor(alliance.synergy.value * 100)}%`,
                '',
                '**Alliance Members**',
                `> You (${this.characterClasses[playerStats.class].emoji} ${playerStats.class})`,
                `> • Health: ${playerStats.health}/100`,
                `> • Energy: ${playerStats.energy}/100`,
                `> • Kills: ${playerStats.kills}`,
                '',
                `> ${ally} (${this.characterClasses[allyStats.class].emoji} ${allyStats.class})`,
                `> • Health: ${allyStats.health}/100`,
                `> • Energy: ${allyStats.energy}/100`,
                `> • Kills: ${allyStats.kills}`,
                '',
                '**Active Effects**',
                ...alliance.synergy.effects.map(effect => 
                    `> • ${this.formatEffectName(effect.type)}: +${effect.value}%`
                )
            ].join('\n'));

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('combine_ability')
                    .setLabel('Combined Ability')
                    .setEmoji('⚡')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!playerStats.specialUses || !allyStats.specialUses),
                new ButtonBuilder()
                    .setCustomId('leave_alliance')
                    .setLabel('Leave Alliance')
                    .setEmoji('💔')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.editReply({
            embeds: [allianceEmbed],
            components: [actionRow]
        });
    }

    formatEffectName(effect) {
        return effect.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    async handleAction(interaction, action) {
        const playerStats = this.stats.get(interaction.user.id);
        if (!playerStats || playerStats.health <= 0) {
            return interaction.reply({
                embeds: [{
                    color: 0x438BEF,
                    description: '> **Ahjin ♱** : You are not an active participant in this game'
                }],
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        switch (action) {
            case 'inventory':
                await this.displayInventory(interaction);
                break;
            case 'stats':
                await this.displayStats(interaction);
                break;
            case 'alliance':
                await this.handleAllianceAction(interaction, 'view');
                break;
        }
    }
}

module.exports = SurvivalGiveaway; 