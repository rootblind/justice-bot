import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collection,
    ColorResolvable,
    ComponentType,
    EmbedBuilder,
    Guild,
    GuildMember,
    Locale,
    Message,
    MessageFlags,
    PermissionFlagsBits,
    Role,
    StringSelectMenuBuilder,
    TextChannel
} from "discord.js";
import { fetchGuildMember, message_collector, resolveSnowflakesToRoles } from "../../utility_modules/discord_helpers.js";
import { has_cooldown } from "../../utility_modules/utility_methods.js";
import LfgSystemRepo from "../../Repositories/lfgsystem.js";
import { LfgGameTable, LfgPostFullRow } from "../../Interfaces/lfg_system.js";
import { embed_error, embed_interaction_expired, embed_message } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { select_lfg_channels_builder } from "./lfg_select_builders.js";
import { bump_lfg_post, delete_lfg_post, fetchPostMessage, lfg_post_builder, stringifyRoles } from "./lfg_post.js";
import { t } from "../../Config/i18n.js";

export function embed_interface_manager(
    gameName: string,
    locale: Locale = Locale.EnglishUS,
    color: ColorResolvable = "Purple"
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(t(locale, "systems.lfg.interface_manager.interface_embed.title"))
        .setAuthor({ name: `LFG ${gameName}` })
        .setDescription(t(locale, "systems.lfg.interface_manager.interface_embed.description"))
        .setFields({
            name: t(locale, "systems.lfg.interface_manager.interface_embed.field.name"),
            value: `**LFG**: ${t(locale, "systems.lfg.interface_manager.interface_embed.field.value.LFG")}
            **Active Posts**: ${t(locale, "systems.lfg.interface_manager.interface_embed.field.value.active_posts")}
            **Info**: ${t(locale, "systems.lfg.interface_manager.interface_embed.field.value.info")}
            **BUMP**: ${t(locale, "systems.lfg.interface_manager.interface_embed.field.value.bump")}
            **Delete**: ${t(locale, "systems.lfg.interface_manager.interface_embed.field.value.delete")}`
        });
}

/**
 * Array of buttons attached to the interface manager of LFG
 */
export function interface_manager_buttons(): ButtonBuilder[] {
    return [
        new ButtonBuilder() // starting the lfg post builder
            .setCustomId("lfg-button")
            .setLabel("LFG")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder() // listing all active posts (existing messages where the voice channel is not full and the member has access)
            .setCustomId("active-lfg-posts")
            .setLabel("Active Posts")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder() // Informative guide about how to build and post an lfg.
            .setCustomId("info-lfg-button")
            .setLabel("Info")
            .setStyle(ButtonStyle.Secondary),
    ]
}

export async function active_lfg_posts(
    guild: Guild,
    game: LfgGameTable,
    member: GuildMember,
    locale: Locale = Locale.EnglishUS
): Promise<EmbedBuilder> {
    // TODO: ADD FILTERS FOR RANKS, ROLES AND GAMEMODES
    const activePostsEmbed = new EmbedBuilder().setColor("Purple").setDescription(t(locale, "systems.lfg.interface_manager.active_lfg_posts.empty.description"));
    const posts: LfgPostFullRow[] = await LfgSystemRepo.getPostsFullByGame(guild.id, game.id);
    if (!posts.length) {
        return activePostsEmbed;
    }

    activePostsEmbed
        .setAuthor({ name: guild.name, iconURL: `${guild.iconURL({ extension: "png" })}` })
        .setTitle(t(locale, "systems.lfg.interface_manager.active_lfg_posts.full.title"));

    const activePostStrings: string[] = [];
    let index = 1;
    const guildEmojis = await guild.emojis.fetch();

    // fetching game roles 
    const rankRows = await LfgSystemRepo.getGameRanks(game.id);
    const ranksResolved: Role[] = await resolveSnowflakesToRoles(guild, rankRows.map(r => r.role_id));

    for (const row of posts) {
        if (index === 25) break; // limit the unfiltered list to 25 results
        try {
            const lfg = await fetchPostMessage(guild, game.id, row.owner_id);
            if (!lfg) continue;

            const owner = await fetchGuildMember(guild, row.owner_id); // the member that posted the lfg
            if (!owner) continue;
            if (!owner.voice.channel) continue;
            if (
                owner.voice.channel.userLimit
                && owner.voice.channel.userLimit < owner.voice.channel.members.size + 1
            ) {
                // userLimit === 0 means the room has no limit
                // if the room is full, then the post is not active for the public
                continue;
            }

            // filter out hidden or locked rooms to the member
            const permsForMember = owner.voice.channel.permissionsFor(member);
            if (!permsForMember) continue;

            const canJoinAndSpeak = permsForMember.has(PermissionFlagsBits.ViewChannel)
                && permsForMember.has(PermissionFlagsBits.Connect)
                && permsForMember.has(PermissionFlagsBits.Speak);

            if (!canJoinAndSpeak) continue;

            // array of resolved role ranks attached to this post
            const postRanks: Role[] = ranksResolved.filter(role => row.roles.map(r => r.role_id).includes(role.id));
            const rankString = stringifyRoles(postRanks, guildEmojis);
            activePostStrings.push(
                `${index++} - ${owner.toString()} \`+${row.slots}\` ${rankString} <t:${row.created_at}:R> [${t(locale, "systems.lfg.interface_manager.active_lfg_posts.jump_to_post")}](${lfg.message.url})`
            );


        } catch { continue; }
    }
    if (activePostStrings.length > 0) activePostsEmbed.setDescription(activePostStrings.join("\n"));
    return activePostsEmbed;
}

export function info_lfg(locale: Locale = Locale.EnglishUS): EmbedBuilder {
    return new EmbedBuilder()
        .setColor("Aqua")
        .setDescription(t(locale, "systems.lfg.interface_manager.info.description"))
        .setFooter({ text: t(locale, "systems.lfg.interface_manager.info.footer") })
}

/**
 * The message collector that handles the button functionalities of the lfg interface manager
 */
export async function interface_manager_collector(message: Message) {
    const channel = message.channel as TextChannel;
    const guild = channel.guild;

    const cooldown = 10;
    const cooldowns = new Collection<string, number>();
    const collector = await message_collector<ComponentType.Button>(message,
        {
            componentType: ComponentType.Button,
        },
        async (buttonInteraction) => {
            const userCooldown = has_cooldown(buttonInteraction.user.id, cooldowns, cooldown);
            const locale = buttonInteraction.locale;
            if (userCooldown) {
                await buttonInteraction.reply({
                    embeds: [embed_message("Red", t(locale, "common.button_inner_cooldown", { cooldown: userCooldown }))],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            cooldowns.set(buttonInteraction.user.id, Math.floor(Date.now() / 1000));
            setTimeout(() => cooldowns.delete(buttonInteraction.user.id), cooldown * 1000);

            // fetch the game row
            const gameTable: LfgGameTable | null = await LfgSystemRepo.getGameByInterface(guild.id, message.id);
            if (!gameTable) {
                await buttonInteraction.reply({
                    embeds: [
                        embed_error(
                            t(locale, "systems.lfg.interface_manager.errors.collector.fetch_game.description"),
                            t(locale, "systems.lfg.interface_manager.errors.collector.title")
                        )
                    ],
                    flags: MessageFlags.Ephemeral
                });

                // this error can occur if somehow the collector is running while the database row was unexpectedly deleted
                // stop the collector
                await errorLogHandle(
                    new Error(`There was a problem while fetching the game row for this interface. Mismatch between the collector and database. guild id ${guild.id} | message id ${message.id}`)
                );
                collector.stop();
                return;
            }

            if (buttonInteraction.customId === "lfg-button" || buttonInteraction.customId === "bump-post-button") {
                // check for force_voice
                const systemConfig = await LfgSystemRepo.getSystemConfigForGuild(guild.id);
                if ((buttonInteraction.member as GuildMember).voice.channelId === null && systemConfig.force_voice) {
                    await buttonInteraction.reply({
                        embeds: [embed_message("Red", t(locale, "common.not_in_voice"))],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                // check if the member is on lfg cooldown before posting or bumping
                const userCooldown = LfgSystemRepo.getCooldown(guild.id, buttonInteraction.user.id, gameTable.id);
                if (userCooldown) {
                    await buttonInteraction.reply({
                        embeds: [
                            embed_message("Red", t(locale, "common.action_on_cooldown", { cooldown: userCooldown }))
                        ],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
            }

            switch (buttonInteraction.customId) {
                case "lfg-button": {
                    const systemConfig = await LfgSystemRepo.getSystemConfigForGuild(guild.id);
                    if ((buttonInteraction.member as GuildMember).voice.channelId === null && systemConfig.force_voice) {
                        // member must be on voice
                        await buttonInteraction.reply({
                            embeds: [
                                embed_message("Red", t(locale, "common.not_in_voice"))
                            ],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                    // once the post is sent successfully, cooldown will be set

                    // fetch all the channel under this game
                    const lfgChannels = (await LfgSystemRepo.getLfgChannelsByGame(gameTable.id))
                        .filter((row) => row.discord_channel_id !== null);

                    if (lfgChannels.length === 0) {
                        await buttonInteraction.reply({
                            embeds: [embed_error("systems.lfg.interface_manager.errors.collector.game_missing_channels")],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    if (lfgChannels.length === 1 && lfgChannels[0]) {
                        // if there is only one channel, then auto-select it
                        await lfg_post_builder(
                            buttonInteraction,
                            guild,
                            buttonInteraction.member as GuildMember,
                            gameTable,
                            lfgChannels[0]
                        );
                    } else {
                        // if there are 2 or more channels, let the user decide
                        await buttonInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            embeds: [embed_message("Purple", t(locale, "systems.lfg.interface_manager.lfg_button.select_channel"))],
                            components: [
                                new ActionRowBuilder<StringSelectMenuBuilder>()
                                    .addComponents(select_lfg_channels_builder(lfgChannels))
                            ]
                        });
                        const reply = await buttonInteraction.fetchReply();

                        const coll = await message_collector<ComponentType.StringSelect>(reply,
                            {
                                componentType: ComponentType.StringSelect,
                                time: 120_000,
                                filter: (i) => i.user.id === buttonInteraction.user.id
                            },
                            async (selectInteraction) => {
                                // check if the member is on lfg cooldown before posting or bumping
                                const userCooldown = LfgSystemRepo.getCooldown(guild.id, buttonInteraction.user.id, gameTable.id);
                                if (userCooldown) {
                                    await selectInteraction.reply({
                                        embeds: [
                                            embed_message("Red", t(locale, "common.action_on_cooldown", { cooldown: userCooldown }))
                                        ],
                                        flags: MessageFlags.Ephemeral
                                    });
                                    coll.stop();
                                    return;
                                }
                                const selectedChannel = lfgChannels
                                    .find((row) => row.discord_channel_id === selectInteraction.values[0])! // the select options are build from this array
                                await lfg_post_builder(
                                    selectInteraction,
                                    guild,
                                    selectInteraction.member as GuildMember,
                                    gameTable,
                                    selectedChannel
                                );
                                coll.stop();
                            },
                            async () => {
                                try {
                                    await buttonInteraction.editReply({
                                        embeds: [embed_interaction_expired(locale)],
                                        components: []
                                    });
                                } catch { /* do nothing */ }
                            }
                        )
                    }
                    break;
                }
                case "active-lfg-posts": {
                    await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });
                    const activeLFGs = await active_lfg_posts(guild, gameTable, (buttonInteraction.member as GuildMember), locale);
                    await buttonInteraction.editReply({
                        embeds: [activeLFGs]
                    });
                    break;
                }

                case "info-lfg-button": {
                    await buttonInteraction.reply({
                        embeds: [info_lfg(locale)],
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }
                case "bump-post-button": {
                    await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });
                    // check lfg cooldown
                    const lfgOnCooldown = LfgSystemRepo.getCooldown(guild.id, buttonInteraction.user.id, gameTable.id);
                    if (lfgOnCooldown) {
                        await buttonInteraction.editReply({
                            embeds: [embed_message("Red", t(locale, "common.action_on_cooldown", { cooldown: lfgOnCooldown }))]
                        });
                        return;
                    }
                    try {
                        const lfgPost = await fetchPostMessage(guild, gameTable.id, buttonInteraction.user.id);
                        if (!lfgPost) {
                            await buttonInteraction.editReply({
                                embeds: [embed_message("Red", t(locale, "systems.lfg.interface_manager.bump_button.no_active_post"))]
                            });
                            return;
                        }
                        const expiresAt = await bump_lfg_post(lfgPost.message, lfgPost.post);
                        if (expiresAt === 0) {
                            await buttonInteraction.editReply({
                                embeds: [
                                    embed_error(t(locale, "systems.lfg.interface_manager.errors.collector.bump_failed"))
                                ]
                            });
                            return;
                        }

                        await buttonInteraction.editReply({
                            embeds: [embed_message("Green", t(locale, "systems.lfg.interface_manager.bump_button.success", { cooldown: expiresAt }))]
                        });
                    } catch (error) {
                        if (error instanceof Error) {
                            await buttonInteraction.editReply({
                                embeds: [embed_error(error.message)]
                            });
                            await errorLogHandle(error);
                        } else {
                            console.error(error);
                        }
                    }

                    break;
                }
                case "delete-post-button": {
                    await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });
                    try {
                        const lfgPost = await fetchPostMessage(guild, gameTable.id, buttonInteraction.user.id);
                        if (!lfgPost) {
                            await buttonInteraction.editReply({
                                embeds: [embed_message("Red", t(locale, "systems.lfg.interface_manager.delete_button.no_active_post"))]
                            });
                            return;
                        }

                        await delete_lfg_post(lfgPost.message, lfgPost.post.id);

                        await buttonInteraction.editReply({
                            embeds: [embed_message("Green", t(locale, "systems.lfg.interface_manager.delete_button.success"))]
                        });
                    } catch (error) {
                        if (error instanceof Error) {
                            await buttonInteraction.editReply({
                                embeds: [embed_error(error.message)]
                            });
                            await errorLogHandle(error);
                        } else {
                            console.error(error);
                        }
                    }
                    break;
                }
            }
        },
        async () => { }
    )
}