/**
 * Factory, getter and setter methods for the Client object.
 * The client can be imported in other sources without circular importing from the main file (justice.js)
 */

import { Client, Options, Partials } from "discord.js";

let botClient: Client | null = null; // the global client object

/**
 * Discord Client factory
 * @param intents Discord intents
 * @param partials Discord partials
 * @returns {} Client object
 * 
 */
export function __init_client__(intents: number[], partials: Partials[]): Client {
    return new Client({
        intents: intents,
        partials: partials,
        makeCache: Options.cacheWithLimits({
            MessageManager: 200,
            GuildMemberManager: 1000,
            UserManager: 1000,
            PresenceManager: 1000,
            ReactionManager: 200,
            ReactionUserManager: 200,
            ThreadMemberManager: 10,

            // Disabled
            StageInstanceManager: 0,
            GuildEmojiManager: 0,
            GuildStickerManager: 0,
            AutoModerationRuleManager: 0
        }),
        sweepers: {
            messages: {
                interval: 300, // every 5 minutes
                lifetime: 900 // remove messages older than 15min
            },
            users: {
                interval: 600,
                filter: () => user => !user.bot && user.username !== null
            },
            threads: {
                interval: 600,
                lifetime: 600
            }
        }
    });
}

/**
 * Discord client setter
 * @param client 
 */
export function setClient(client: Client) {
    botClient = client;
}

/**
 * The Discord Client getter.
 * @returns The current Discord Client
 * 
 * Throws an error if called before the client being initialized
 */
export function getClient(): Client {
    if(!botClient) throw new Error("Client not initialized, call setClient or __init_client__ before the getter.");
    return botClient;
}