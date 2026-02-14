import { ButtonBuilder, ButtonStyle, ColorResolvable, EmbedBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, type Guild, type GuildBan, type GuildTextBasedChannel, type User } from "discord.js";
import { embed_ban, embed_ban_dm, embed_message, embed_unban } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import PunishLogsRepo from "../../Repositories/punishlogs.js";
import BanListRepo from "../../Repositories/banlist.js";
import { timestampNow } from "../../utility_modules/utility_methods.js";
import { BanList, PunishLogs } from "../../Interfaces/database_types.js";

/**
 * Build the embed to send in logChannel if it exists and register the punishment in punishlogs
 * @param guild The guild object
 * @param target The banned user
 * @param moderator The moderator
 * @param punishmentType 2- tempban; 3- indefinite ban; 4- permanent ban
 * @param reason The reason of the ban
 * @param logChannel The moderation logs channel if it exists
 * @param expirationTimestamp The timestamp when the ban will expire if it's a tempban
 * @param no_registry Whether the ban needs to be registered in punishlogs
 */
export async function log_ban(
    guild: Guild,
    target: User,
    moderator: User,
    punishmentType: 2 | 3 | 4,
    reason: string = "No reason specified",
    logChannel: GuildTextBasedChannel | null = null,
    expirationTimestamp?: string,
    no_registry: boolean = false,
) {
    if (logChannel) {
        try { // send the log to the log channel
            await logChannel.send({
                embeds: [
                    embed_ban(target, moderator, punishmentType, reason, undefined, expirationTimestamp)
                ]
            });
        } catch (error) {
            await errorLogHandle(error, `Failed logging the ban of ${target.id} from ${guild.name}[${guild.id}]`);
        }
    }

    if (no_registry === false) {
        // register in punishlogs
        const currentTimestamp = String(Math.floor(Date.now() / 1000));
        await PunishLogsRepo.insertLog(
            guild.id,
            target.id,
            moderator.id,
            punishmentType,
            reason,
            currentTimestamp
        );
    }
}

/**
 * Ban the targeted user and configure how the ban is handled
 * @param guild Guild object
 * @param target The target of the ban
 * @param moderator The executor of the ban
 * @param punishmentType 2- tempban; 3- indefinite ban; 4- permanent ban
 * @param reason The reason of the ban
 * @param duration The duration in seconds if punishmentType = 2; DO NOT GIVE A DURATION FOR PERMANENT BANS
 * @param logChannel The moderation logs channel if it exists
 * @param no_punishlog Boolean whether to register punishlogs. True = no registration
 * @param send_dm Boolean whether to DM the target about the ban. True = send dm
 * @param no_update Whether to update banlist or not (does nothing in the case of indefinite ban). True = no registration
 */
export async function ban_handler(
    guild: Guild,
    target: User,
    moderator: User,
    punishmentType: 2 | 3 | 4,
    reason: string = "No reason specified",
    deleteMessages: boolean = true,
    duration?: string,
    logChannel: GuildTextBasedChannel | null = null,
    no_punishlog: boolean = false,
    send_dm: boolean = true,
    no_update: boolean = false
) {
    if (punishmentType === 2 && !duration) {
        throw new Error("punishmentType = 2 (tempban) but no duration provided");
    }
    if (punishmentType === 4 && typeof duration === "string") {
        throw new Error("punishmentType = 4 (permanent ban) can not be given a duration")
    }

    const deletionTime = deleteMessages ? 604800 : 0;

    if (send_dm) {
        // try to dm the user about the ban
        try {
            await target.send({
                embeds: [
                    embed_ban_dm(
                        guild,
                        moderator,
                        punishmentType,
                        reason,
                        undefined,
                        duration ? `${Number(duration) + timestampNow()}` : undefined
                    )
                ]
            });
        } catch { /* do nothing */ };
    }

    try {
        await guild.bans.create(target.id, {
            reason: `${moderator.username} | ${reason}`,
            deleteMessageSeconds: deletionTime
        });
    } catch (error) {
        await errorLogHandle(error, `Failed to ban ${target.id} from ${guild.name}[${guild.id}]`);
        return;
    }

    // handle logging the event
    await log_ban(
        guild,
        target,
        moderator,
        punishmentType,
        reason,
        logChannel,
        duration ? `${Number(duration) + timestampNow()}` : undefined,
        no_punishlog
    );

    // registering the ban in banlist
    if (no_update === false && (punishmentType === 2 || punishmentType === 4)) {
        const isUserPermabanned = await BanListRepo.isUserPermabanned(guild.id, target.id);
        if (isUserPermabanned) return; // if the user is permabanned, do not allow unbanning through temporary ban overwriting the permanent one
        // tempban or permaban
        const expires = duration ? Number(duration) + timestampNow() : 0;
        await BanListRepo.push(
            guild.id,
            target.id,
            moderator.id,
            expires,
            reason
        )
    }
}

/**
 * Log the event and remove the ban from database.
 * 
 * @param guild Guild object
 * @param target The user that is being unbanned
 * @param moderator The moderator that executed the unban
 * @param logChannel The log channel to post this event if given 
 * @param reason The reason for the ban. Defaults to "No reason"
 */
export async function unban_log(
    guild: Guild,
    target: User,
    moderator: User,
    logChannel: GuildTextBasedChannel | null = null,
    reason: string = "No reason"
) {
    await BanListRepo.deleteBan(guild.id, target.id); // remove the ban from database

    if (logChannel) {
        try {
            await logChannel.send({
                embeds: [
                    embed_unban(
                        target,
                        moderator,
                        reason
                    )
                ]
            });
        } catch (error) {
            await errorLogHandle(error, `Failed to log guildBanRemove event from ${guild.name}[${guild.id}]`);
        }
    }
}

/**
 * Unban the targeted user and call unban_log()
 * 
 * @param guild Guild object
 * @param target The user that is being unbanned
 * @param moderator The moderator that executed the unban
 * @param logChannel The log channel to post this event if given 
 * @param reason The reason for the ban. Defaults to "No reason"
 */
export async function unban_handler(
    guild: Guild,
    target: User,
    moderator: User,
    logChannel: GuildTextBasedChannel | null = null,
    reason: string = "No Reason"
) {
    try {
        await guild.bans.remove(target, reason);
        await unban_log(guild, target, moderator, logChannel, reason);
    } catch (error) {
        await errorLogHandle(error);
    }
}

export interface BanLookupData {
    ban: GuildBan | null,
    banData: BanList | null,
    banLog: PunishLogs | null
}

export async function ban_lookup(
    guild: Guild,
    target: User,
): Promise<BanLookupData | null> {
    let ban: GuildBan | null = null;
    const banLookupData: BanLookupData = {
        ban: null,
        banData: null,
        banLog: null
    }
    try {
        ban = await guild.bans.fetch(target);
        banLookupData.ban = ban;
    } catch {
        ban = null;
    }

    if (!ban) {
        return null;
    }

    const banData = await BanListRepo.getGuildBan(guild.id, target.id);
    const banLog = await PunishLogsRepo.fetchLastBan(guild.id, target.id);

    banLookupData.banData = banData;
    banLookupData.banLog = banLog;

    return banLookupData;


}

export function embed_ban_details(
    target: User,
    data: BanLookupData | null,
    color: ColorResolvable = "Purple"
): EmbedBuilder {
    if (!data || !data.ban) {
        return embed_message("Red", `${target} is not currently banned.`, "Invalid ban")
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: `${target.username} ban details`,
            iconURL: target.displayAvatarURL({ extension: "jpg" })
        })
        .addFields({
            name: "User",
            value: `${target}`
        });

    if (data.banData) {
        embed.addFields({
            name: "Expires",
            value: Number(data.banData.expires) > 0 ? `<t:${data.banData.expires}:R>` : "Permanent"
        });
    } else {
        embed.addFields({
            name: "Expires",
            value: "Indefinite"
        });
    }

    const banDict = {
        2: "Temporary",
        3: "Indefinite",
        4: "Permanent"
    }

    if (data.banLog) { // prefer punishlogs
        embed.addFields(
            {
                name: "Reason",
                value: data.banLog.reason
            },
            {
                name: "Moderator",
                value: `<@${data.banLog.moderator}>`
            },
            {
                name: "Ban Type",
                value: banDict[data.banLog.punishment_type as 2 | 3 | 4]
            },
            {
                name: "Timestamp",
                value: `<t:${data.banLog.timestamp}:R>`
            }
        )
    } else if (data.banData) { // they logs don't exist, fallback on the ban data
        embed.addFields(
            {
                name: "Reason",
                value: data.banData.reason
            },
            {
                name: "Moderator",
                value: `<@${data.banData.moderator}>`
            },
            {
                name: "Ban Type",
                value: Number(data.banData.expires) > 0 ? banDict[2] : banDict[4]
            }
        )
    } else { // if that doesn't exist either, fallback again on discord data
        embed.addFields({
            name: "Reason",
            value: data.ban.reason ?? "No reason specified"
        });
    }

    return embed;
}

export function unban_button(
    id: string = "unban-button",
    label: string = "Unban",
    style: ButtonStyle = ButtonStyle.Danger
): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style)
}

export function reasonInputLabel(): LabelBuilder {
    const reasonInput = new TextInputBuilder()
        .setCustomId("reason-input")
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(4)
        .setMaxLength(1024)
        .setPlaceholder("Enter the reason...")
        .setRequired(true)

    const label = new LabelBuilder()
        .setLabel("Reason")
        .setDescription("The reason for this aciton.")
        .setTextInputComponent(reasonInput);

    return label;
}