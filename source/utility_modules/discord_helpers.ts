import type {
    Client, Guild, GuildBan, GuildBasedChannel, GuildMember, GuildTextBasedChannel, 
    PermissionResolvable, Role, Snowflake,
    User,
} from "discord.js";
import { EmbedBuilder, PermissionFlagsBits, ActivityType } from "discord.js";
import { get_env_var, random_number, read_json_async } from "./utility_methods.js";
import { PresenceConfig, PresencePreset, PresencePresetKey } from "../Interfaces/helper_types.js";
import { errorLogHandle } from "./error_logger.js";
import ServerLogsRepo from "../Repositories/serverlogs.js";

/**
 * 
 * @param guild Guild object
 * @returns The bot as GuildMember object if valid
 */
export async function fetch_bot_member(guild: Guild | null): Promise<GuildMember | undefined> {
    if(!guild) return undefined;

    try {
        return await guild.members.fetchMe();
    } catch(error) {
        console.error("Failed to fetch bot member object: ", error);
        return undefined;
    }
}

/**
 * Resolves the permission flag bits to its string name
 * @param permission 
 * @returns Array of the permission(s) as a string array of their names
 */
export function permission_names(permission: PermissionResolvable): string[] {
    const perms = Array.isArray(permission) ? permission : [permission];

    return perms.map(p => {
        if (typeof p === "string") return p;
        const entry = Object.entries(PermissionFlagsBits).find(
            ([, value]) => BigInt(value) === BigInt(p)
        );
        return entry ? entry[0] : p.toString();
    });
}

/**
 * Fetches the guild if the id is valid or nothing goes wrong.
 * To be avoided if failing to fetch requires error handling.
 * @param client Bot Client
 * @param guildID Snowflake
 * @returns Guild object or null if the id is invalid
 */
export async function fetchGuild(client: Client, guildID: Snowflake): Promise<Guild | null> {
    let guild = null;
    try {
        guild = await client.guilds.fetch(guildID);
    } catch { /* the guild doesn't exist, do nothing */ }
    return guild;
}

/**
 * Fetches the ban object if the id is valid or nothing goes wrong.
 * To be avoided if failing to fetch requires error handling.
 * @param guild Guild object
 * @param id Snowflake of the banned user
 * @returns GuildBan object
 */
export async function fetchGuildBan(guild: Guild, id: Snowflake): Promise<GuildBan | null> {
    let ban = null;
    try {
        ban = await guild.bans.fetch(id);
    } catch { /* the ban doesn't exist, do nothing */ }
    
    return ban;
}


/**
 * Fetches the guild member if the id is valid or nothing goes wrong.
 * To be avoided if failing to fetch requires error handling.
 * @param guild Guild object
 * @param id Snowflake of the member
 * @returns GuildMember object
 */
export async function fetchGuildMember(guild: Guild, id: Snowflake): Promise<GuildMember | null> {
    let member = null;
    try {
        member = await guild.members.fetch(id);
    } catch {/* the member doesn't exist, do nothing */}
    
    return member;
    
}

/**
 * Fetches the guild channel if the id is valid or nothing goes wrong.
 * To be avoided if failing to fetch requires error handling.
 * @param guild Guild object
 * @param id Snowflake of the channel to be fetched
 * @returns The channel as GuildBasedChannel. Cast to a more specific channel type if needed
 */
export async function fetchGuildChannel(guild: Guild, id: Snowflake): Promise<GuildBasedChannel | null> {
    let channel = null;
    try {
        channel = await guild.channels.fetch(id);
    } catch {/* The channel doesn't exist, do nothing */}

    return channel;
}

/**
 * Fetches the guild role if the id is valid or nothing goes wrong.
 * To be avoided if failing to fetch requires error handling.
 * @param guild Guild object
 * @param id Snowflake of the role to be fetched
 * @returns The Role object
 */
export async function fetchGuildRole(guild: Guild, id: Snowflake): Promise<Role | null> {
    let role = null;
    try {
        role = await guild.roles.fetch(id);
    } catch {/* The role doesn't exist, do nothing */}

    return role;
}

/**
 * 
 * @param client Client type
 * @param presence PresencePreset object contains activity keys paired with string[] of activities
 * @param actList String array of PresencePresetKey type representing discord activities from the preset config
 * 
 * This method is called to randomly assign the presence of the client (bot)
 */
export function status_setter (client: Client, presence: PresencePreset, actList: PresencePresetKey[]) {
    if(!client.user) throw new Error("The client doesn't have an user property")
    if(actList.length === 0) throw new Error("The actList is empty!")

    // selecting the active presence
    const selectActivityType: PresencePresetKey = actList[random_number(actList.length)] ?? "Playing"; 

    const selectActivityString = presence[ selectActivityType ][ random_number(presence[selectActivityType].length) ]
        ?? "League of Legends";

    
    client.user.setPresence({
        activities: [
            {
                name: selectActivityString,
                type: ActivityType[selectActivityType],
            },
        ],
        status: "online",
    });
}

/**
 * 
 * @param presenceConfigFile string
 * @param defaultPresetFile string
 * @param customPresetFile string | null
 * @returns An object containing the parsed objects of the presence config and the preset object
 * 
 * Used to update the information about the presence config and the selected preset
 */
export async function read_or_update_presence(
    presenceConfigFile: string,
    defaultPresetFile: string,
    customPresetFile: string | null = null
) {
    const presenceConfig: PresenceConfig = await read_json_async(presenceConfigFile);
    const presenceFilePath = presenceConfig.type === 0 ?
        defaultPresetFile : customPresetFile;

    if(!presenceFilePath) {
        throw new Error("The presence configuration is set to type 1 (custom preset) but the preset file provided is null or doesn't exist");
    }

    const presetObject: PresencePreset = await read_json_async(presenceFilePath);

    return { presenceConfig, presetObject };
}

/**
 * 
 * @param client Client object
 * @param presenceConfigFile string to the presence config file
 * @param defaultPresetFile string to the default preset file (./objects)
 * @param customPresetFile string to the custom preset file (./objects)
 * 
 * Must be used inside try-catch block, it's a handler for the bot's presence setup
 */
export async function bot_presence_setup(
    client: Client,
    presenceConfigFile: string,
    defaultPresetFile: string,
    customPresetFile: string | null = null
) {
    const activityTypes: PresencePresetKey[] = ["Playing", "Listening", "Watching"];
    let { presenceConfig, presetObject } = 
        await read_or_update_presence(presenceConfigFile, defaultPresetFile, customPresetFile);
    let autoUpdatePresence: NodeJS.Timeout; // this variable will act as the interval ID of auto-update presenc

    if(presenceConfig.status === "enable") {
        status_setter(client, presetObject, activityTypes);
        if(presenceConfig.delay) {
            autoUpdatePresence = setInterval(async () => {
                // refreshing the content of the config and preset
                ({ presenceConfig, presetObject } = 
                    await read_or_update_presence(presenceConfigFile, defaultPresetFile, customPresetFile));
                if(presenceConfig.status !== "enable") {
                    clearInterval(autoUpdatePresence);
                } else {
                    status_setter(client, presetObject, activityTypes);
                }

            }, presenceConfig.delay * 1000);
        }
    } else if(presenceConfig.status !== "disable") {
        // if status is an invalid string, not enable, nor disable
        throw new Error("Presence config status is an invalid string format, it must be set to either enable or disable");
    }
}

export async function fetch_home_server_owner(client: Client) {
    try {
        const homeServer = await client.guilds.fetch(String(get_env_var("HOME_SERVER_ID")));
        const owner = await homeServer.members.fetch(String(get_env_var("OWNER")));
        return owner;
    } catch(error) {
        await errorLogHandle(error);
        return null;
    }
}

export async function notifyOwnerDM(client: Client, message: string | EmbedBuilder) {
    try {
        const owner: User | null = await client.users.fetch(get_env_var("OWNER"));
        if(!owner) {
            console.error(`Couldn't fetch the owner user object using the ID: ${get_env_var("OWNER")}`);
            return;
        }

        if(typeof message === "string") {
            await owner.send(message);
        } else {
            await owner.send({embeds: [ message ]});
        }
    } catch(error) {
        console.error(error);
    }

}

/**
 * 
 * @param guild Guild object
 * @param event EventGuildLogs type string
 * @returns The channel of the event logs or null if something failed
 */
export async function fetchLogsChannel(guild: Guild, event: string) {
    let channelId: Snowflake | null = null;
    try { // fetching the channel id from the database
        channelId = await ServerLogsRepo.getGuildEventChannel(guild.id, event);
    } catch(error) {
        await errorLogHandle(error, `Failed to get serverlogs channel id from ${guild.name}[${guild.id}]`);
    }
            
    if(channelId) {
        // if there is a channel set, fetch the channel object
        let channel: GuildTextBasedChannel | null = null;
        try{
            channel = await guild.channels.fetch(channelId) as GuildTextBasedChannel;
        } catch(error) {
            await errorLogHandle(error, `Failed to fetch the log channel[${channelId}] from ${guild.name}[${guild.id}]`);
        }

        if(channel) {
            // if fetching the channel succeeded, return the channel object
            return channel;
        }

    } else {
        return null;
    }
}