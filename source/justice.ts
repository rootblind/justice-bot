import {config} from 'dotenv';
import {
    GatewayIntentBits, Routes, Partials, Collection,
} from 'discord.js';

import { __init_client__, setClient } from './client_provider.js';

import { REST } from "@discordjs/rest";

config();

import { get_env_var } from "./utility_modules/utility_methods.js";
import { error_logger, errorLogHandle } from './utility_modules/error_logger.js';

// Load modules (events and commands)
import { load_events } from './Handlers/eventHandler.js';
import { load_commands } from './Handlers/commandHandler.js';

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
const CLIENT_ID = get_env_var("CLIENT_ID");
const GUILD_ID = get_env_var("HOME_SERVER_ID");

const rest = new REST({ version: '10'}).setToken(TOKEN);
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
    const commands: unknown[] = [];
    
    try {
        console.log("Refreshing slash commands");
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
            body: commands
        });

        await client.login(TOKEN);
        await load_events(client);
        await load_commands(client);
    } catch(error) {
        await errorLogHandle(error);
    }
}

main();

export default client;