const { Events } = require('discord.js');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        try {
            await oldState.client.levelingManager.handleVoiceStateUpdate(oldState, newState);
        } catch (error) {
            console.error('Error in voice state update:', error);
        }
    }
}; 