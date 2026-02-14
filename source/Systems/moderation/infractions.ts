import { ColorResolvable, EmbedBuilder, User } from "discord.js";
import { PunishLogs } from "../../Interfaces/database_types.js";
import { timestampNow } from "../../utility_modules/utility_methods.js";
import { PunishmentType } from "../../objects/enums.js";

export type InfractionsListType =
    | "full"
    | "warn"
    | "timeout"
    | "ban";

/**
 * Do note: the PunishLogs array is taken as is, no sorting, no filtering is being done by this method.
 * 
 * You must filter the array to match the desired type.
 * 
 * @param user The user whose logs are being displayed
 * @param type The type of the list
 * @param infractions PunishLogs array of user's logs corresponding to the type given
 * @param color The color of embeds
 * @returns Array of embeds showing user's infractions list
 */
export function embedInfractionsCompleteList(
    user: User,
    type: InfractionsListType,
    infractions: PunishLogs[],
    color: ColorResolvable = "Purple"
): EmbedBuilder[] {
    const punishDict = {
        0: "Warn",
        1: "Timeout",
        2: "Tempban",
        3: "Indefinite Ban",
        4: "Permaban"
    }
    let embed =
        new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: `${user.username}'s ${type} list`, iconURL: user.displayAvatarURL({ extension: 'png' }) })

    if (infractions.length === 0) return [embed.setDescription("No results, the list is empty.")];
    embed.setDescription(`**${type.toUpperCase()}**: ${infractions.length}`)
    const embedList: EmbedBuilder[] = [];
    let index = 0;
    for (const row of infractions) {
        ++index;
        embed.addFields({
            name: `ID: ${row.id}`,
            value: `**Infraction**: ${punishDict[row.punishment_type].toUpperCase()}` +
                `\n**Reason**: ${row.reason}\n**Time**: <t:${row.timestamp}:R>`
        });

        // fields is ensured since one is already added before this check
        if (embed.data.fields!.length % 25 === 0 || index === infractions.length) {
            embedList.push(embed);
            embed = new EmbedBuilder().setColor(color)
        }
    }

    return embedList;
}

/**
 * Do note: This method sorts and slices the PunishLogs array given, but it doesn't filter it.
 * 
 * You must filter the array to match the desired type.
 * 
 * @param user The user to build the list for
 * @param type The type of infractions to be displayed. Using "full" will be treated like an overview 
 * @param infractions The array of punishlogs that corresponds to the type
 * @param color The color of the embed
 * @returns The embed
 */
export function embedInfractionsShortList(
    user: User,
    type: InfractionsListType,
    infractions: PunishLogs[],
    color: ColorResolvable = "Purple"
): EmbedBuilder {
    const punishDict = {
        0: "Warn",
        1: "Timeout",
        2: "Tempban",
        3: "Indefinite Ban",
        4: "Permaban"
    }
    const page = type === "full" ? "overview" : type;
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
            name: `${user.username}'s ${page} page`
        })
        .setThumbnail(user.displayAvatarURL({ extension: "png" }))

    if (infractions.length === 0) return embed.setDescription("No infractions registered for this list.");

    const infractionsCount = page === "overview" ? 5 : 20; // on overview page, limit the infractions shown to 5 instead of 20
    const listInfractions = [...infractions]
        .sort((a, b) => Number(b.timestamp) - Number(a.timestamp)) // make sure the list is ordered descending
        .slice(0, infractionsCount)
        .map(i => `${page === "overview" ? `**${punishDict[i.punishment_type]}**: ` : ""}${i.reason} - <t:${i.timestamp}:R>`)
        .join("\n");

    embed.addFields(
        {
            name: "Total",
            value: `${infractions.length} infraction${infractions.length > 1 ? "s" : ""}`
        },
        {
            name: "Last month",
            value: infractions
                .filter(i => Number(i.timestamp) >= (timestampNow() - 2_592_000)) // a months in seconds
                .length
                .toString() + ` infraction${infractions.length > 1 ? "s" : ""}`
        },
        {
            name: `Last ${infractionsCount} ${page !== "overview" ? type : ""} infractions`,
            value: listInfractions
        }
    )

    return embed;
}

/**
 * Filter functions depending on the general type of the infraction. Bans are grouped together (2, 3, 4)
 */
export const punishDictFilter: Record<
    InfractionsListType,
    (infraction: PunishLogs) => boolean
> = {
    full: () => true,
    ban: i => i.punishment_type >= PunishmentType.TEMPBAN,
    timeout: i => i.punishment_type === PunishmentType.TIMEOUT,
    warn: i => i.punishment_type === PunishmentType.WARN
}

export const pageTypes: InfractionsListType[] = ["full", "ban", "timeout", "warn"];