import type {
    Client, Guild, GuildBan, GuildMember, PermissionResolvable, Snowflake,
} from "discord.js";
import { EmbedBuilder, PermissionFlagsBits, ActivityType } from "discord.js";
import { random_number, read_json_async } from "./utility_methods.js";
import { PresenceConfig, PresencePreset, PresencePresetKey } from "../Interfaces/helper_types.js";

export async function fetch_bot_member(guild: Guild | null): Promise<GuildMember | undefined> {
    if(!guild) return undefined;

    try {
        return await guild.members.fetchMe();
    } catch(error) {
        console.error("Failed to fetch bot member object: ", error);
        return undefined;
    }
}

export function embed_error(description: string, title?: string) {
    return new EmbedBuilder()
        .setColor("Red")
        .setTitle(title || "Error")
        .setDescription(description);
}

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

export async function fetchGuild(client: Client, guildID: Snowflake): Promise<Guild | null> {
    let guild = null;
    try {
        guild = await client.guilds.fetch(guildID);
    } catch { /* the guild doesn't exist, do nothing */ }
    return guild;
}

export async function fetchBan(guild: Guild, id: Snowflake): Promise<GuildBan | null> {
    let ban = null;
    try {
        ban = await guild.bans.fetch(id);
    } catch { /* the ban doesn't exist, do nothing */ }
    
    return ban;
}

export async function fetchMember(guild: Guild, id: Snowflake): Promise<GuildMember | null> {
    let member = null;
    try {
        member = await guild.members.fetch(id);
    } catch {/* the ban doesn't exist, do nothing */}
    
    return member;
    
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