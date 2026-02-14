import {
    ColorResolvable,
    EmbedBuilder,
    Guild,
    GuildMember,
    TextChannel,
    User
} from "discord.js";
import PunishLogsRepo from "../../Repositories/punishlogs.js";
import { seconds_to_duration, timestampNow } from "../../utility_modules/utility_methods.js";
import AutopunishRuleRepo from "../../Repositories/autopunishrule.js";
import { fetchGuildBan, fetchGuildMember } from "../../utility_modules/discord_helpers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { embed_timeout, embed_timeout_dm } from "../../utility_modules/embed_builders.js";
import { PunishmentType } from "../../objects/enums.js";
import { ban_handler } from "./ban_system.js";

export function embed_warn_dm(
    moderatorUsername: string,
    guild: Guild,
    reason: string,
    color: ColorResolvable = "Red"
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: `${moderatorUsername} gave you a warning`,
            iconURL: `${guild.iconURL({ extension: "png" })}`
        })
        .setDescription(`You have been warned on **${guild.name}**!`)
        .addFields(
            {
                name: "Moderator",
                value: moderatorUsername
            },
            {
                name: "Reason",
                value: reason
            }
        )
        .setTimestamp()
}

export function embed_warn(
    target: GuildMember,
    moderator: GuildMember,
    reason: string,
    color: ColorResolvable = "Red"
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: `${target.user.username} has been warned`,
            iconURL: target.displayAvatarURL({ extension: "jpg" })
        })
        .addFields(
            {
                name: "Target",
                value: `${target}`,
                inline: true
            },
            {
                name: "Moderator",
                value: `${moderator}`,
                inline: true
            },
            {
                name: "Reason",
                value: reason
            }
        )
        .setTimestamp()
        .setFooter({ text: `Target ID: ${target.id}` })
}

export function embed_unwarn(
    targetUsername: string,
    moderator: GuildMember,
    color: ColorResolvable = "Green"
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `${moderator.user.username} removed a warning` })
        .addFields(
            {
                name: "Target",
                value: targetUsername,
                inline: true
            },
            {
                name: "Moderator",
                value: moderator.user.username,
                inline: true
            }
        )
        .setTimestamp()
        .setFooter({ text: `Moderator ID: ${moderator.id}` })
}

/**
 * @returns the id of the warning
 */
export async function warn_handler(
    guild: Guild,
    target: User,
    moderator: User,
    reason: string = "No reason",
    logChannel: TextChannel | null = null
): Promise<number> {
    const punishLog = await PunishLogsRepo.insertLog(
        guild.id,
        target.id,
        moderator.id,
        PunishmentType.WARN,
        reason,
        String(timestampNow())
    );

    // handle autopunish rules
    // fetch the rules that could be triggered by the count of target's warns
    const rulesData = await AutopunishRuleRepo.getActiveRulesForTarget(guild.id, target.id);
    // if this warn came from a ban, the rules won't trigger
    const ban = await fetchGuildBan(guild, target.id);
    if (ban) return punishLog.id; // stop the execution here
    const targetMember = await fetchGuildMember(guild, target.id);
    if (!targetMember) return punishLog.id; // the rule doesn't trigger if the targeted member is not currently a member
    const botMember = await guild.members.fetchMe();

    for (const rule of rulesData) {
        if (rule.activewarns >= rule.warncount) {
            // when the member has >= active warns than the threshold of the rule
            // then the rule is triggered
            switch (rule.punishment_type) {
                case 1: {
                    // 1 - timeout
                    if (targetMember.isCommunicationDisabled()) {
                        // if the warn was given through timeout, the rule shouldn't override the timeout
                        break;
                    }

                    try {
                        // time in milliseconds
                        await targetMember.timeout(Number(rule.punishment_duration) * 1000, `Autorule triggered | Last warn: ${reason}`);
                    } catch (error) {
                        await errorLogHandle(error);
                    }

                    // try to notify the targeted member
                    try {
                        await target.send({
                            embeds: [
                                embed_timeout_dm(
                                    seconds_to_duration(Number(rule.punishment_duration)) ?? "unknown",
                                    guild,
                                    botMember.user,
                                    `Autorule triggered | Last warn: ${reason}`
                                )
                            ]
                        });
                    } catch { /* do nothing */ }

                    if (logChannel) {
                        await logChannel.send({
                            embeds: [
                                embed_timeout(
                                    targetMember,
                                    botMember,
                                    seconds_to_duration(Number(rule.punishment_duration)) ?? "unknown",
                                    timestampNow() + Number(rule.punishment_duration),
                                    `Autorule triggered | Last warn: ${reason}`
                                )
                            ]
                        });
                    }

                    // register the punishment
                    await PunishLogsRepo.insertLog(
                        guild.id,
                        target.id,
                        botMember.id,
                        PunishmentType.TIMEOUT,
                        `Autorule triggered | Rule ID [${rule.id}]`,
                        String(timestampNow())
                    );
                    break;
                }
                case 2: {
                    // 2 - tempban
                    try {
                        await ban_handler(
                            guild,
                            target,
                            botMember.user,
                            PunishmentType.TEMPBAN,
                            `Autorule triggered | Last warn: ${reason}`,
                            true, // delete messages
                            String(rule.punishment_duration),
                            logChannel
                        );
                    } catch (error) {
                        await errorLogHandle(error);
                    }
                    break;
                }
                case 3: {
                    // 3 - indefinite ban
                    try {
                        await ban_handler(
                            guild,
                            target,
                            botMember.user,
                            PunishmentType.INDEFINITE_BAN,
                            `Autorule triggered | Last warn: ${reason}`,
                            true, // delete messages
                            undefined, // no duration for indefinite ban
                            logChannel
                        );
                    } catch (error) {
                        await errorLogHandle(error);
                    }
                    break;
                }
            }

            // for-loop break
            break; // rules are ordered in a way that the first rule from the for loop that is triggered is the right one
            // and the rest shouldn't be triggered
        }
    }
    // return the warn id
    return punishLog.id;
}