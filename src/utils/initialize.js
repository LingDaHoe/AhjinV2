require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { connect } = require('mongoose');
const { loadCommands, loadEvents } = require('../handlers/loader');

async function deployCommands(commands) {
    try {
        console.log('Started refreshing application (/) commands.');
        const rest = new REST().setToken(process.env.TOKEN);
        
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
}

async function connectDatabase() {
    try {
        console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);
        
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        await connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

async function initializeBot(client) {
    try {
        await connectDatabase();
        
        const commandData = await loadCommands(client);
        await deployCommands(commandData);
        await loadEvents(client);
        
        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error('Initialization error:', error);
        process.exit(1);
    }
}

module.exports = { initializeBot }; 