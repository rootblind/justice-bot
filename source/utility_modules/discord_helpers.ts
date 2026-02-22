/**
 * Toolkit implementing helpful methods revolving around the Discord API
 */

import {
    APIApplicationCommandBasicOption,
    APIApplicationCommandOption,
    APIApplicationCommandSubcommandGroupOption,
    APIApplicationCommandSubcommandOption,
    ApplicationCommandOptionType,
    AutoModerationRuleTriggerType,
    ButtonInteraction,
    CacheType,
    CategoryChannel,
    ChannelSelectMenuInteraction,
    ChannelType,
    ChatInputCommandInteraction,
    Client, Collection, Guild, GuildBan, GuildBasedChannel, GuildMember,
    InteractionCollector,
    MappedInteractionTypes,
    Message,
    MessageComponentInteraction,
    MessageComponentType,
    MessageFlags,
    NonThreadGuildBasedChannel,
    OverwriteResolvable,
    PermissionResolvable, Role, RoleSelectMenuInteraction, SendableChannels, Snowflake,
    StringSelectMenuInteraction,
    TextChannel,
    User,
    UserSelectMenuInteraction,
    VoiceChannel,
} from "discord.js";
import { EmbedBuilder, PermissionFlagsBits, ActivityType } from "discord.js";
import { get_env_var, random_number, read_json_async } from "./utility_methods.js";
import {
    CollectorCollectHandler,
    CollectorFilterCustom,
    CollectorStopHandler,
    PresenceConfig,
    PresencePreset,
    PresencePresetKey
} from "../Interfaces/helper_types.js";
import { errorLogHandle } from "./error_logger.js";
import ServerLogsRepo from "../Repositories/serverlogs.js";
import type { EventGuildLogsString } from "../Interfaces/database_types.js";
import ServerRolesRepo from "../Repositories/serverroles.js";
import PremiumMembersRepo from "../Repositories/premiummembers.js";
import fs from "graceful-fs";
import { escapeRegex } from "./curate_data.js";
import { regexClassifier } from "./regex_classifier.js";
import ServerLogsIgnoreRepo from "../Repositories/serverlogsignore.js";
import { embed_interaction_expired } from "./embed_builders.js";

/**
 * 
 * @param guild Guild object
 * @returns The bot as GuildMember object if valid
 */
export async function fetch_bot_member(guild: Guild | null): Promise<GuildMember | undefined> {
    if (!guild) return undefined;

    try {
        return await guild.members.fetchMe();
    } catch (error) {
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
        guild = await client.guilds.fetch({ guild: guildID, force: true });
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
    } catch {/* the member doesn't exist, do nothing */ }

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
    } catch {/* The channel doesn't exist, do nothing */ }

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
    } catch {/* The role doesn't exist, do nothing */ }

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
export function status_setter(client: Client, presence: PresencePreset, actList: PresencePresetKey[]) {
    if (!client.user) throw new Error("The client doesn't have a user property")
    if (actList.length === 0) throw new Error("The actList is empty!")

    // selecting the active presence
    const selectActivityType: PresencePresetKey = actList[random_number(actList.length - 1)] ?? "Playing";

    const selectActivityString = presence[selectActivityType][random_number(presence[selectActivityType].length - 1)]
        ?? "League of Legends";


    client.user.setPresence({
        activities: [
            {
                name: selectActivityType + " " + selectActivityString,
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

    if (!presenceFilePath) {
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
    let autoUpdatePresence: NodeJS.Timeout; // this variable will act as the interval ID of auto-update presence

    if (presenceConfig.status === "enable") {
        status_setter(client, presetObject, activityTypes);
        if (presenceConfig.delay) {
            autoUpdatePresence = setInterval(async () => {
                // refreshing the content of the config and preset
                ({ presenceConfig, presetObject } =
                    await read_or_update_presence(presenceConfigFile, defaultPresetFile, customPresetFile));
                if (presenceConfig.status !== "enable") {
                    clearInterval(autoUpdatePresence);
                } else {
                    status_setter(client, presetObject, activityTypes);
                }

            }, presenceConfig.delay * 1000);
        }
    } else if (presenceConfig.status !== "disable") {
        // if status is an invalid string, not enable, nor disable
        throw new Error("Presence config status is an invalid string format, it must be set to either enable or disable");
    }
}

/**
 * @returns The owner GuildMember from the home server 
 */
export async function fetch_home_server_owner(client: Client) {
    try {
        const homeServer = await client.guilds.fetch(String(get_env_var("HOME_SERVER_ID")));
        const owner = await homeServer.members.fetch(String(get_env_var("OWNER")));
        return owner;
    } catch (error) {
        await errorLogHandle(error);
        return null;
    }
}

/**
 * The bot will DM the bot owner. Used in error handling, but it can be used for any purpose of DM'ing the owner
 * @param message The message to be sent as a string or as an embed
 */
export async function notifyOwnerDM(client: Client, message: string | EmbedBuilder): Promise<void> {
    try {
        const owner: User | null = await client.users.fetch(get_env_var("OWNER"));
        if (!owner) {
            console.error(`Couldn't fetch the owner user object using the ID: ${get_env_var("OWNER")}`);
            return;
        }

        if (typeof message === "string") {
            await owner.send(message);
        } else {
            await owner.send({ embeds: [message] });
        }
    } catch (error) {
        console.error(error);
    }

}

/**
 * 
 * @param guild Guild object
 * @param event EventGuildLogs type string
 * @returns The channel of the event logs or null if something failed
 */
export async function fetchLogsChannel(guild: Guild, event: EventGuildLogsString):
    Promise<TextChannel | null> {
    let channelId: Snowflake | null = null;
    try { // fetching the channel id from the database
        channelId = await ServerLogsRepo.getGuildEventChannel(guild.id, event);
    } catch (error) {
        await errorLogHandle(error, `Failed to get serverlogs channel id from ${guild.name}[${guild.id}]`);
    }

    if (!channelId) return null;
    const channel = await fetchGuildChannel(guild, channelId) as TextChannel | null;

    if (channel === null) {
        // if the channel is still null after the fetch, then there must be a faulty row
        await ServerLogsRepo.deleteGuildEventChannel(guild.id, event);
    }

    return channel;
}

/**
 * 
 * @param client Client object
 * @param guild Guild object or the guild id
 * @returns The role object of the designated premium server role
 */
export async function fetchPremiumRole(client: Client, guild: Guild | Snowflake): Promise<Role | null> {
    let guildObject: Guild | null = null;
    if (typeof guild === "string") { // if a snowflake of the guild was given, fetch the guild object
        guildObject = await fetchGuild(client, guild);

    } else {
        guildObject = guild;
    }

    if (!guildObject) return null; // invalid guild
    const premiumGuildRoleId = await ServerRolesRepo.getGuildPremiumRole(guildObject.id);
    if (!premiumGuildRoleId) return null; // invalid guild
    const premiumRole = await fetchGuildRole(guildObject, premiumGuildRoleId);

    if (premiumRole === null) {
        // if premiumRole is null even after fetching, there must be a faulty row
        await ServerRolesRepo.deleteGuildRole(guildObject.id, "premium");
    }
    return premiumRole;
}

/**
 * 
 * @param client Client object
 * @param guild Guild object or the guild id
 * @returns The role object of the designated staff server role
 */
export async function fetchStaffRole(client: Client, guild: Guild | Snowflake): Promise<Role | null> {
    let guildObject: Guild | null = null;
    if (typeof guild === "string") { // if a snowflake of the guild was given, fetch the guild object
        guildObject = await fetchGuild(client, guild);

    } else {
        guildObject = guild;
    }

    if (!guildObject) return null; // invalid guild
    const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guildObject.id);
    if (!staffRoleId) return null; // invalid guild
    const staffRole = await fetchGuildRole(guildObject, staffRoleId);

    if (staffRole === null) {
        // if staff role is still null, must be a faulty row
        await ServerRolesRepo.deleteGuildRole(guildObject.id, "staff");
    }
    return staffRole;
}

/**
 * 
 * @param client Client object
 * @param guild Guild object or the guild id
 * @returns The role object of the designated ticket support server role
 */
export async function fetchTicketSupportRole(client: Client, guild: Guild | Snowflake): Promise<Role | null> {
    let guildObject: Guild | null = null;
    if (typeof guild === "string") { // if a snowflake of the guild was given, fetch the guild object
        guildObject = await fetchGuild(client, guild);

    } else {
        guildObject = guild;
    }

    if (!guildObject) return null; // invalid guild
    const ticketSupportRoleId = await ServerRolesRepo.getGuildTicketSupportRole(guildObject.id);
    if (!ticketSupportRoleId) return null; // invalid guild
    const ticketSupportRole = await fetchGuildRole(guildObject, ticketSupportRoleId);

    if (ticketSupportRole === null) {
        // if staff role is still null, must be a faulty row
        await ServerRolesRepo.deleteGuildRole(guildObject.id, "ticket-support");
    }
    return ticketSupportRole;
}

/**
 * 
 * @param client Client object
 * @param guild Guild object
 * @param member Member object or member snowflake
 * @returns The custom role if the member has premium status and a custom role
 */
export async function fetchMemberCustomRole(client: Client,
    guild: Guild | Snowflake,
    member: Snowflake | GuildMember
) {
    let guildObject: Guild | null = null;
    if (typeof guild === "string") { // if a snowflake of the guild was given, fetch the guild object
        guildObject = await fetchGuild(client, guild);

    } else {
        guildObject = guild;
    }

    if (!guildObject) return null; // invalid guild

    const memberId = typeof member === "string" ? member : member.id;
    const customRoleId = await PremiumMembersRepo.getMemberCustomRole(guildObject.id, memberId);
    if (!customRoleId) return null; // the member doesn't have a customrole registered

    const customRole = await fetchGuildRole(guildObject, customRoleId);
    return customRole;

}

/**
 * Prints the content of the message inside a .txt and sends it to logChannel
 * @param message Message object or a string
 * @param logChannel The channel where the file will be dumped
 * @param fileId The name of the file inside /temp
 * @param filePath The path to temp directory
 * @returns The url of the dump as string
 */
export async function dumpMessageFile(
    message: Message | string,
    logChannel: TextChannel,
    fileId: string,
    filePath: string = `./temp/${fileId}.txt`
): Promise<string> {

    const content = message instanceof Message ? message.content : message;
    fs.writeFile(filePath, content, (error: Error) => {
        console.error(error);
    });

    const sendFile = await logChannel.send({ files: [filePath] });
    fs.unlink(filePath, (error: Error) => {
        if (error) throw error;
    });

    return sendFile.url;
}

/**
 * Create a message component collector for the given message using the handlers,
 * @param message The message object to have components collected from
 * @param componentType The type of the components interactions to be collected
 * @param filter The filter method called by the collector based on interaction
 * @param onStart The "collect" event handler
 * @param onStop The "end" event handler
 */
export async function message_collector<T extends MessageComponentType>(
    message: Message,
    options: {
        componentType: T,
        filter?: CollectorFilterCustom,
        time?: number
    },
    onStart: CollectorCollectHandler<MappedInteractionTypes[T]>,
    onStop: CollectorStopHandler<MappedInteractionTypes[T]>,
): Promise<InteractionCollector<MappedInteractionTypes<boolean>[T]>> {
    const collector = message.createMessageComponentCollector(options);

    collector.on("collect", async (interaction) => {
        // collect only the defined component type interactions
        if (interaction.componentType !== options.componentType) return;
        // call the handler
        await onStart(interaction as MappedInteractionTypes[T]);
    });

    collector.on("end", async (collected) => {
        // type predicate to narrow the interaction
        const isTargetType = (
            i: MessageComponentInteraction<CacheType>
        ): i is MappedInteractionTypes[T] =>
            i.componentType === options.componentType;

        // filter for the predicate
        const typedCollected = collected.filter(isTargetType);
        await onStop(typedCollected);
    });

    return collector;
}

export function isSubcommand(
    option: unknown
): option is APIApplicationCommandSubcommandOption {
    return (
        typeof option === "object" &&
        option !== null &&
        "type" in option &&
        (option as { type: number }).type === ApplicationCommandOptionType.Subcommand
    );
}

export function isSubcommandGroup(
    option: unknown
): option is APIApplicationCommandSubcommandGroupOption {
    return (
        typeof option === "object" &&
        option !== null &&
        "type" in option &&
        (option as { type: number }).type === ApplicationCommandOptionType.SubcommandGroup
    );
}

export function isArgument(
    option: unknown
): option is APIApplicationCommandBasicOption {
    return (
        typeof option === "object" &&
        option !== null &&
        "type" in option &&
        (option as { type: number }).type !== ApplicationCommandOptionType.Subcommand &&
        (option as { type: number }).type !== ApplicationCommandOptionType.SubcommandGroup
    );
}

/**
 * 
 * @param options Command options
 * @returns The option between brackets depending if it's required or not
 */
export function renderArgs(
    options?: readonly APIApplicationCommandOption[]
): string {
    if (!options?.length) return "";

    return options
        .filter(isArgument)
        .map(o => (o.required ? `<${o.name}>` : `[${o.name}]`))
        .join(" ");
}

export function automodRegex(word: string): string {
    return escapeRegex(word.toLowerCase())
}

export async function getAutoModWords(guild: Guild): Promise<{ words: string[]; ruleName: string }[]> {
    const manager = guild.autoModerationRules;
    const rawRules = await manager.fetch();
    const rules = Array.from(
        rawRules
            .filter(
                rule => {
                    return rule.triggerType === AutoModerationRuleTriggerType.Keyword && rule.enabled;
                }
            ).values()
    );
    const list = rules.map(r => ({ words: r.triggerMetadata.keywordFilter, ruleName: r.name }));
    return JSON.parse(JSON.stringify(list));
}

export async function fetchAutoModList(guild: Guild): Promise<string[]> {
    const rules = await getAutoModWords(guild);
    return rules.flatMap(r => r.words);
}

// removed the automod blocked words until a filter can be implemented
// automod rules may apply only on specific channels for other purposes than to filter toxicity
export async function getAllTriggerPatterns(
    localPatterns: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    guild: Guild
): Promise<string[]> {
    // const automodWords = await fetchAutoModList(guild);
    // const automodPatterns = automodWords.map(automodRegex);

    return Array.from(
        new Set(
            [...localPatterns] // [...localPatterns, ...automodPatterns]
                .map(p => p.trim())
                .filter(Boolean)
        )
    );
}

export async function hasBlockedContent(
    input: string,
    localRegexPatterns: string[],
    guild: Guild
): Promise<boolean> {

    const patterns = await getAllTriggerPatterns(localRegexPatterns, guild);
    if (!patterns.length) return false;

    return regexClassifier(input, patterns) !== false;
}

/**
 * Iterate through a Snowflake array and return true if any of the ids is a bot in the guild.
 */
export async function anyBots(guild: Guild, userIds: string[]): Promise<boolean> {
    for (const id of userIds) {
        const member = await fetchGuildMember(guild, id);
        if (member && member.user.bot) return true;
    }

    return false;
}

/**
 * Iterate through a Snowflake array and return true if any of the ids is a guild member that has the staff server role
 */
export async function anyStaff(guild: Guild, userIds: string[]): Promise<boolean> {
    const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guild.id);
    if (!staffRoleId) return false; // if no staff role is set, then there can't be any staff member no matter what
    for (const id of userIds) {
        const member = await fetchGuildMember(guild, id);
        if (member && member.roles.cache.has(staffRoleId)) return true;
    }
    return false;
}

/**
 * Given an array of IDs, the method tries to resolve them to guild channels before deletion
 * 
 * All successful and failed resolutions are returned as an object with resolved/unresolved string arrays. 
 */
export async function resolveAndDeleteChannels(
    guild: Guild,
    channels: string[]
): Promise<{ resolved: string[], unresolved: string[] }> {
    const response: { resolved: string[], unresolved: string[] } = { resolved: [], unresolved: [] };
    for (const id of channels) {
        try {
            const channel = await guild.channels.fetch(id);
            if (channel) {
                await channel.delete();
                response.resolved.push(id);
            } else {
                response.unresolved.push(id);
            }
        } catch {
            response.unresolved.push(id);
        }
    }

    return response;
}

/**
 * Handler for database.
 * 
 * Set a channel as the logs channel for the specified event.
 * 
 * If the event already has a channel, the method will handle that case too.
 */
export async function setLogChannel(guildId: Snowflake, channelId: Snowflake, event: EventGuildLogsString) {
    const logChannelId = await ServerLogsRepo.getGuildEventChannel(guildId, event); // if the event already has a channel
    // if set log channel is called on an event that is already set, the method will handle
    // inserting the new channel in serverlogs instead and swapping the channels from ignore list
    if (logChannelId !== null) await ServerLogsIgnoreRepo.stopIgnoringChannel(guildId, logChannelId);

    // insert the rows
    await ServerLogsRepo.put(guildId, channelId, event);
    await ServerLogsIgnoreRepo.put(guildId, channelId);
}

/**
 * 
 * @param guild Guild object
 * @param categoryName The name of the category
 * @param perms Array of permissions
 * @param channelOptions Array of channel name and channel type objects
 * @returns All channels created by calling this method, including the category
 */
export async function buildCategory(
    guild: Guild,
    categoryName: string,
    perms: OverwriteResolvable[],
    channelOptions: {
        name: string,
        type: ChannelType.GuildText | ChannelType.GuildVoice
    }[]
): Promise<(TextChannel | VoiceChannel | CategoryChannel)[]> {
    const category = await guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: perms
    });

    const channelsBuilt: (TextChannel | VoiceChannel | CategoryChannel)[] = [category];

    for (const config of channelOptions) {
        try {
            const channel = await category.children.create({
                name: config.name,
                type: config.type
            });
            channelsBuilt.push(channel);
        } catch (error) {
            await errorLogHandle(error);
        }
    }

    return channelsBuilt;
}

/**
 * @param ids Array of role snowflakes to be resolved 
 * @returns Array of discord roles from the ids provided. Failed resolve will skip the ID
 */
export async function resolveSnowflakesToRoles(guild: Guild, ids: string[]): Promise<Role[]> {
    const roles: Role[] = [];
    for (const id of ids) {
        const role = await fetchGuildRole(guild, id);
        if (role) roles.push(role);
    }

    return roles;
}

/**
 * 
 * @param type one of NonThreadGuildBasedChannel types
 * @returns Array of channels resolved from the ids. If any Id is invalid, it is skipped
 */
export async function resolveSnowflakesToChannels<
    T extends NonThreadGuildBasedChannel
>(
    guild: Guild,
    ids: string[],
    guard: (c: NonThreadGuildBasedChannel) => c is T
): Promise<T[]> {
    const channels = await guild.channels.fetch();

    return ids.map(id => channels.get(id))
        .filter(c => c !== null && c !== undefined)
        .filter(guard);
}

/**
 * Messages fetched this way are not guaranteed to have the guild non-null.
 * 
 * @param channel The channel where the message is sent.
 * @param messageId The Snowflake of the message to be fetched
 * @returns The message or null if the fetch failed
 */
export async function fetchMessage(channel: SendableChannels, messageId: Snowflake): Promise<Message | null> {
    let message: Message | null = null;
    try {
        message = await channel.messages.fetch(messageId);
    } catch {/* do nothing */ }

    return message;
}

/**
 * Fetch all guild bans. Attention as this function ban be API intensive.
 * @returns A collection of GuildBan objects
 */
export async function fetchAllBans(guild: Guild): Promise<Collection<string, GuildBan>> {
    const allBans = new Collection<string, GuildBan>();
    let lastBanId: string = "";
    try {
        let banBatch = await guild.bans.fetch({ limit: 1000 });
        while (true) {
            banBatch.forEach((ban, id) => allBans.set(id, ban));
            if (banBatch.size < 1) break;
            lastBanId = banBatch.lastKey()!;
            banBatch = await guild.bans.fetch({ limit: 1000, after: lastBanId });
        }
    } catch (error) {
        await errorLogHandle(error);
    }

    return allBans;
}

//////////////////////////////////////////////////////
// DISCORD CHANNEL SCRAPPER INCORPORATED IN JUSTICE //
//////////////////////////////////////////////////////
export interface DiscordChannelScrapperResponse {
    lastId: string,
    messages: Message[]
}

export type DiscordScrapperMessageFilter = (message: Message<boolean>) => boolean;

/**
 * Fetching discord channel messages is ordered by their timestamp in a descendent order.
 * 
 * @remark Calling this method inside an interaction requires the reply to be defered.
 * 
 * @param channel The channel to be scraped
 * @param lastId Message snowflake of where the scrapping should start from (before: lastId)
 * 
 * @returns The last id that was fetched (the oldest in the array) and the array of all messages fetched 
 * in chronological ascendent order and optionally filtered by the given method
 * @throws It may reach Discord API ratelimit: 429 Too Many Requests
 */
export async function channel_scrapper(
    channel: TextChannel,
    lastId?: string,
    messageFilter?: DiscordScrapperMessageFilter
): Promise<DiscordChannelScrapperResponse> {
    // the total batch of messages
    let messages: Message<boolean>[] = [];


    // total batch size is limited to 50k at a time since through testing, 80k is the upper limit at a time.
    const totalBatchSizeLimit = 50_000;
    let messageBatch: Collection<string, Message<boolean>> = await channel.messages.fetch({
        limit: 100,
        ...(lastId && { before: lastId })
    });
    // keep track of current last id
    let currentLastId;
    // while there are messages to be fetched and the total batch size 
    do {
        // add the current batch to the total batch
        messages = messages.concat(Array.from(messageBatch.values()));
        currentLastId = messageBatch.lastKey()!; // update the current last key
        // fetch another batch
        messageBatch = await channel.messages.fetch({ limit: 100, before: currentLastId });
    } while (messageBatch.size !== 0 && messages.length < totalBatchSizeLimit);

    // after the execution, the scrapper can return the response
    // prepare the response
    if (messageFilter) {
        messages = messages.filter(messageFilter);
    }

    messages.reverse();

    return {
        lastId: currentLastId,
        messages: messages
    }
}
////////////////////////////////////////////////////

/**
 * If the error is issued by Modal Timeout, then if the interaction is given, it will follow up with 
 * embed_interaction_expired message response.
 * 
 * errorLogHandle is called for other types of errors
 * 
 * @param error The error thrown
 * @param interaction The interaction that awaits modal response
 */
export async function handleModalCatch(
    error: unknown,
    interaction?:
        | ChatInputCommandInteraction<CacheType>
        | ButtonInteraction<CacheType>
        | StringSelectMenuInteraction<CacheType>
        | RoleSelectMenuInteraction<CacheType>
        | ChannelSelectMenuInteraction<CacheType>
        | UserSelectMenuInteraction<CacheType>
) {
    if (error instanceof Error && error.message.includes("reason: time")) {
        if (interaction) {
            await interaction.followUp({
                flags: MessageFlags.Ephemeral,
                embeds: [embed_interaction_expired()]
            });
        }
        return;
    }
    await errorLogHandle(error);
}

export function hasVoiceMembers(guild: Guild, channelId: Snowflake): boolean {
    return guild.voiceStates.cache.some(vs => vs.channelId === channelId);
}

/**
 * Awaiting for each guild to become available
 */
export async function gatewayStability(client: Client, silent: boolean = false) {
    // awaiting guilds to become available
    const timeout = 15_000; //15s
    if (!silent) {
        console.log(`gatewayStability was called, please wait a few seconds for every guild to be available.`);
        console.log(`Maximum timeout: ${Math.floor(timeout) / 1000} seconds.`);
    }
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const unavailable = client.guilds.cache.some(g => !g.available);
        if (!unavailable) break;
        await new Promise(res => setTimeout(res, 1_000));
    }

    await new Promise(res => setTimeout(res, 5_000));
}