const { readdirSync } = require('fs');
const { join } = require('path');

async function loadCommands(client) {
    const commands = [];
    const commandsPath = join(__dirname, '..', 'commands');
    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = join(commandsPath, folder);
        const commandFiles = readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            try {
                const filePath = join(folderPath, file);
                const commandModule = require(filePath);
                
                // Check if it's a class that extends Command
                if (commandModule.prototype?.constructor) {
                    const command = new commandModule();
                    if (command.data && command.execute) {
                        client.commands.set(command.name, command);
                        commands.push(command.data().toJSON());
                    }
                } else {
                    console.warn(`Command at ${filePath} is not a valid command class`);
                }
            } catch (error) {
                console.error(`Error loading command from ${file}:`, error);
            }
        }
    }

    return commands;
}

async function loadEvents(client) {
    const eventsPath = join(__dirname, '..', 'events');
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = join(eventsPath, file);
        const event = require(filePath);

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
}

module.exports = { loadCommands, loadEvents }; 