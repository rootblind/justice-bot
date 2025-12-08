import type { Guild, GuildTextBasedChannel, User } from "discord.js";
import { embed_ban, embed_ban_dm } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import PunishLogsRepo from "../../Repositories/punishlogs.js";
import BanListRepo from "../../Repositories/banlist.js";

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
    punishmentType: number,
    reason: string = "No reason specified",
    logChannel: GuildTextBasedChannel | null = null,
    expirationTimestamp?: string,
    no_registry: boolean = false,
) {
    if(logChannel) {
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
 * @param duration The duration if punishmentType = 2
 * @param logChannel The moderation logs channel if it exists
 * @param no_punishlog Boolean whether to register punishlogs. True = no registration
 * @param send_dm Boolean whether to DM the target about the ban. True = send dm
 * @param no_update Whether to update banlist or not (does nothing in the case of indefinite ban). True = no registration
 */
export async function ban_handler(
    guild: Guild,
    target: User,
    moderator: User,
    punishmentType: number,
    reason: string = "No reason specified",
    deleteMessages: boolean = true,
    duration?: string,
    logChannel: GuildTextBasedChannel | null = null,
    no_punishlog: boolean = false,
    send_dm: boolean = true,
    no_update: boolean = false
) {
    if(punishmentType === 2 && !duration) {
        throw new Error("punishmentType = 2 (tempban) but no duration provided");
    }

    const deletionTime = deleteMessages ? 604800 : 0;

    if(send_dm) {
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
                        duration
                    )
                ]
            });
        } catch { /* do nothing */};
    }

    await log_ban(
        guild,
        target,
        moderator,
        punishmentType,
        reason,
        logChannel,
        duration,
        no_punishlog
    );

    try {
        await guild.bans.create(target.id, {
            reason: `${moderator.username} | ${reason}`,
            deleteMessageSeconds: deletionTime
        });
    } catch(error) {
        await errorLogHandle(error, `Failed to ban ${target.id} from ${guild.name}[${guild.id}]`);
    }

    // registering the ban in banlist
    if(no_update === false && (punishmentType === 2 || punishmentType === 4)) {
        // tempban or permaban
        const expires = duration ?? 0;
        await BanListRepo.push(
            guild.id,
            target.id,
            moderator.id,
            expires,
            reason
        )
    }
}