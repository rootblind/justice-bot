/**
 * Main/Index source file, the Client object is initialized, all commands and events are loaded, readies the
 * Discord API implementation before the bot goes online
 */

import { config } from 'dotenv';
config();
import {
    GatewayIntentBits, Partials, Collection,
} from 'discord.js';

import { __init_client__, setClient } from './client_provider.js';

// import { REST } from "@discordjs/rest";

import { get_env_var } from "./utility_modules/utility_methods.js";
import { error_logger, errorLogHandle } from './utility_modules/error_logger.js';

// Load modules (events and commands)
import { load_events } from './Handlers/eventHandler.js';
import { load_commands, registerGlobalCommands } from './Handlers/commandHandler.js';

const intents = Object.values(GatewayIntentBits).filter(
    (v): v is number => typeof v === "number"
);
const partials = Object.values(Partials).filter(
    (v): v is Partials => typeof v === "string"
);

const client = __init_client__(intents, partials);
setClient(client);

client.cooldowns = new Collection(); // collection for commands cooldowns: used in interactionCreate

//env variables
const TOKEN = get_env_var("BOT_TOKEN");
// const CLIENT_ID = get_env_var("CLIENT_ID");
// const GUILD_ID = get_env_var("HOME_SERVER_ID");

// const rest = new REST({ version: '10'}).setToken(TOKEN);
client.commands = new Collection();

process.on('uncaughtException', (error) => {
    error_logger.error(`Unhandled Exception: ${error.message}`, {stack: error.stack});
    setTimeout(() => {
            process.exit(1);
    }, 5_000);
});

process.on('unhandledRejection', (reason) => {
    if(reason instanceof Error) {
        error_logger.error(`Unhandled Reject: ${reason.message}`, {stack: reason.stack});
        setTimeout(() => {
            process.exit(1);
        }, 5_000);
    } else {
        error_logger.error(`Unhandled Reject: ${JSON.stringify(reason)}`);
    }
});


async function main() {
    try {
        console.log("Refreshing slash commands");

        await client.login(TOKEN); // keep login at top
        await load_commands(client); // loading command sources comes above registering them
        await registerGlobalCommands(client);
        await load_events(client); // keep events to bottom
    } catch(error) {
        await errorLogHandle(error);
    }
}

main();

export default client;