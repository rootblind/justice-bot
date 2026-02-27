import { ActionRowBuilder, ButtonBuilder, ColorResolvable, EmbedBuilder, Guild, GuildMember, Locale, TextChannel } from "discord.js";
import { ConfigElement, LfgParserConfig } from "./objects/lfg_objects.js";
import { t } from "../Config/i18n.js";
import { LfgChannelTable, LfgGamemodeTable, LfgPost, LfgPostAndRoleIds } from "../Interfaces/lfg_system.js";
import LfgSystemRepo from "../Repositories/lfgsystem.js";
import { stringifyRoles, embed_lfg_post, lfg_post_buttons, embed_lfg_post_log, deletePostOnLFG, lfg_post_collector } from "../Systems/lfg/lfg_post.js";
import { resolveSnowflakesToRoles, fetchLogsChannel } from "../utility_modules/discord_helpers.js";
import { timestampNow } from "../utility_modules/utility_methods.js";

export interface LfgParsedMessage {
    slots: number | null,
    gamemode: string | null,
    role_list: string[],
    rank_range: string[],
    additional_info: string

}

function normalize(msg: string): string {
    return msg
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function lookupMapBuilder(items: ConfigElement[]): Map<string, string> {
    const map = new Map<string, string>();

    for (const item of items) {
        const canonical = item.name.toLowerCase();
        map.set(canonical, canonical);

        for (const alias of item.alias) {
            map.set(alias.toLowerCase(), canonical);
        }
    }

    return map;
}

export function parseLFG(rawMessage: string, config: LfgParserConfig): LfgParsedMessage {
    const message = normalize(rawMessage);
    const tokens = message.split(" ");

    const gameModeMap = lookupMapBuilder(config.gameModes);
    const roleMap = lookupMapBuilder(config.roles);
    const rankMap = lookupMapBuilder(config.ranks);
    const rankOrdered = config.ranks.map(r => r.name.toLowerCase());

    const result: LfgParsedMessage = {
        slots: null,
        gamemode: null,
        role_list: [],
        rank_range: [],
        additional_info: ""
    }

    if (tokens.length < 2) return result;

    const slotsMatch = tokens[0]!.match(/^\+(\d+)/);
    if (!slotsMatch) return result;

    const slots = parseInt(slotsMatch[1]!, 10);
    if (slots < 1) {
        result.slots = 1;
    } else if (slots > 99) {
        result.slots = 99;
    } else {
        result.slots = slots;
    }

    const gm = gameModeMap.get(tokens[1]!);
    if (!gm) return result;
    result.gamemode = gm;

    const consumedTokens = new Set([0, 1]);

    for (let i = 2; i < tokens.length; i++) {
        const token = tokens[i]!;

        if (token.includes("/")) { // role list is separated by slashes: mid/top/adc
            // role list
            const roles = token.split("/");
            const mappedRoles = roles.map(r => roleMap.get(r)).filter(r => typeof r === "string");

            if (mappedRoles.length === roles.length) {
                result.role_list.push(...mappedRoles);
                consumedTokens.add(i);
                continue;
            }
        }

        if (token.includes("-")) {
            // a rank range is composed of two ranks separated by a dash "-": gold-diamond
            const [startRaw, endRaw] = token.split("-");
            if (!startRaw || !endRaw) continue;
            const start = rankMap.get(startRaw)!;
            const end = rankMap.get(endRaw)!;

            if (start && end) {
                const startIndex = rankOrdered.indexOf(start);
                const endIndex = rankOrdered.indexOf(end);

                if (startIndex <= endIndex) {
                    result.rank_range = [...rankOrdered.slice(startIndex, endIndex + 1)];
                    consumedTokens.add(i);
                    continue;
                }
            }
        }

        const rank = rankMap.get(token);
        if (rank) {
            result.rank_range = [rank];
            consumedTokens.add(i);
            continue;
        }

        const role = roleMap.get(token);
        if (role) {
            result.role_list.push(role);
            consumedTokens.add(i);
            continue;
        }
    }

    const additionalTokens = tokens.filter((_, index) => !consumedTokens.has(index));
    result.additional_info = additionalTokens.join(" ");

    return result;
}

export function wrong_lfg_format(locale: Locale = Locale.EnglishUS, color: ColorResolvable = "Red"): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(t(locale, "lolro.lfg_parser.wrong.title"))
        .setDescription(t(locale, "lolro.lfg_parser.wrong.description"))
        .addFields({
            name: t(locale, "lolro.lfg_parser.wrong.field.name"),
            value: t(locale, "lolro.lfg_parser.wrong.field.value")
        })
        .setFooter({ text: t(locale, "lolro.lfg_parser.wrong.footer") })
}

export async function parsedPostBuilder(
    lfgChannel: LfgChannelTable,
    gamemodeTable: LfgGamemodeTable,
    gameId: number,
    guild: Guild,
    parsedLfg: LfgParsedMessage,
    member: GuildMember,
    channel: TextChannel
) {
    if (parsedLfg.slots === null || parsedLfg.gamemode === null) return null;

    // fetch the roles
    const lfgRoles = await LfgSystemRepo.getAllGameLfgRoles(gameId);
    const resolvedLfgRoles =
        await resolveSnowflakesToRoles(
            guild,
            lfgRoles.map(r => r.role_id)
        );

    // filter for the roles and ranks that are parsed
    const resolvedParsedRoles = resolvedLfgRoles
        .filter(r =>
            parsedLfg.role_list.includes(r.name.toLowerCase())
        );
    const resolvedParsedRanks = resolvedLfgRoles
        .filter(r =>
            parsedLfg.rank_range.includes(r.name.toLowerCase())
        );

    // fetch the emojis and stringify the ranks and roles
    const guildEmojis = await guild.emojis.fetch();
    const stringRanks = stringifyRoles(resolvedParsedRanks, guildEmojis);
    const stringRoles = stringifyRoles(resolvedParsedRoles, guildEmojis);

    // post the message
    const postMessage = await channel.send({
        embeds: [
            embed_lfg_post(
                member,
                gamemodeTable.name,
                parsedLfg.slots,
                parsedLfg.additional_info,
                stringRanks,
                stringRoles,
                guild.preferredLocale // posts are in guild's language
            )
        ],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(...lfg_post_buttons())]
    });

    // post in logs
    const lfgLogs = await fetchLogsChannel(guild, "lfg-logs");
    if (lfgLogs) { // log the event if logs are set up
        await lfgLogs.send({
            embeds: [
                embed_lfg_post_log(
                    member,
                    "League of Legends", // placeholder atm
                    gamemodeTable.name,
                    parsedLfg.slots,
                    parsedLfg.additional_info,
                    stringRanks,
                    stringRoles
                )
            ]
        });
    }

    // delete previous post if it exists
    await deletePostOnLFG(guild, gameId, member.id);

    const lfgPostObject: LfgPost = {
        guild_id: guild.id,
        game_id: gameId,
        channel_id: lfgChannel.id,
        gamemode_id: gamemodeTable.id,
        message_id: postMessage.id,
        owner_id: member.id,
        description: parsedLfg.additional_info ? parsedLfg.additional_info : null,
        slots: parsedLfg.slots,
        created_at: timestampNow()
    }

    // discord snowflakes for roles and ranks 
    const selectedSnowflakes = new Set([...resolvedParsedRoles, ...resolvedParsedRanks].map(r => r.id));
    const lfgPostFull: LfgPostAndRoleIds = {
        post: lfgPostObject,
        attachedRoleIds: lfgRoles
            .filter(r => selectedSnowflakes.has(r.role_id))
            .map(r => r.id)
    }
    const lfgPostTable = await LfgSystemRepo.registerPost(lfgPostFull);

    await LfgSystemRepo.setCooldown(guild.id, member.id, gameId); // put poster on cooldown
    // attach the collector to the lfg post
    await lfg_post_collector(postMessage, lfgPostTable);
}