import {
    GuildMember,
    ColorResolvable,
    RestOrArray,
    APIEmbedField,
    EmbedBuilder,
    ChatInputCommandInteraction,
    CacheType,
    ButtonInteraction,
    StringSelectMenuInteraction,
    Guild,
    TextChannel,
    MessageFlags,
    ModalBuilder,
    Role,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    Message,
    Collection,
    Snowflake,
    ComponentType,
    GuildEmoji,
    EmbedAuthorData,
    Locale
} from "discord.js";
import {
    LfgChannelTable,
    LfgGameTable,
    LfgPost,
    LfgPostAndRoleIds,
    LfgPostTable,
    LfgPostWithChannelTable
} from "../../Interfaces/lfg_system.js";
import { local_config } from "../../objects/local_config.js";
import LfgSystemRepo from "../../Repositories/lfgsystem.js";
import {
    fetchGuildChannel,
    resolveSnowflakesToRoles,
    hasBlockedContent,
    fetchLogsChannel,
    message_collector,
    fetchMessage
} from "../../utility_modules/discord_helpers.js";
import { embed_error, embed_message, embed_interaction_expired } from "../../utility_modules/embed_builders.js";
import { select_gamemode_label, slots_label, select_roles_label, select_rank_label, add_details_label } from "./lfg_modals.js";
import { duration_to_seconds, has_cooldown, timestampNow } from "../../utility_modules/utility_methods.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { t } from "../../Config/i18n.js";

/**
 * for the ranks and roles, attempt to fetch their icons if the emoji icon has the same
 * 
 * normalized name as the role's normalized name; default to the role itself otherwise
 */
export function stringifyRoles(roles: Role[], guildEmojis: Collection<string, GuildEmoji>) {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "-");
    return roles
        .map(r => {
            if (r.unicodeEmoji) return r.unicodeEmoji;
            const emoji = guildEmojis.find(e => normalize(e.name) === normalize(r.name));
            if (emoji) return emoji.toString();
            return r.toString();
        })
        .join(" ");
}

/**
 * ranks and roles are expected to be a string of the roles and ranks selected.
 * 
 * If there are guild emojies with the same normalized name as the roles and ranks selected, those should be used instead.
 */
export function embed_lfg_post(
    member: GuildMember,
    gamemode: string,
    slots: number,
    details: string,
    ranks: string,
    roles: string,
    locale: Locale = Locale.EnglishUS,
    color: ColorResolvable = "DarkRed"
) {
    const fields: RestOrArray<APIEmbedField> = [];
    const author: Omit<EmbedAuthorData, "proxyIconURL"> = { name: `🔊 LFG +${slots} ${gamemode}` };
    if (ranks) {
        fields.push({
            name: t(locale, "dictionary.Ranks"),
            value: ranks
        });
    }
    if (roles) {
        fields.push({
            name: t(locale, "dictionary.Roles"),
            value: roles
        });
    }

    if (member.voice.channel) {
        author.url = member.voice.channel.url;
        fields.push({
            name: t(locale, "dictionary.Channel"),
            value: `${member.voice.channel}`
        });
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: member.displayName, iconURL: member.guild.iconURL({ extension: "png" })! })
        .setAuthor(author)
        .setThumbnail(member.displayAvatarURL({ extension: "jpg" }))
        .setFields(fields)
    if (details) embed.setDescription(details);

    return embed;
}

/**
 * Embed builder for the lfg-logs
 */
export function embed_lfg_post_log(
    member: GuildMember,
    gameName: string,
    gamemode: string,
    slots: number,
    details: string,
    ranks: string,
    roles: string,
    color: ColorResolvable = "Aqua"
) {
    const fields: RestOrArray<APIEmbedField> = [];
    if (ranks) {
        fields.push({
            name: "Ranks",
            value: ranks
        });
    }
    if (roles) {
        fields.push({
            name: "Roles",
            value: roles
        });
    }

    if (member.voice.channel) {
        fields.push({
            name: "Channel",
            value: `${member.voice.channel?.name} (${member.voice.channel?.id})`
        });
    }

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTimestamp()
        .setTitle(`${member.user.username} posted for Game: ${gameName}`)
        .setFooter({ text: `${member.user.id}`, iconURL: member.displayAvatarURL({ extension: "jpg" }) })
        .setAuthor({ name: `🔊 LFG +${slots} ${gamemode}` })
        .setFields(fields)
    if (details) embed.setDescription(details);

    return embed;
}

export function lfg_post_buttons(): ButtonBuilder[] {
    return [
        new ButtonBuilder() // re-send the exact same post
            .setCustomId("bump-post-button")
            .setLabel("BUMP")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder() // delete the post
            .setCustomId("delete-post-button")
            .setLabel("Delete")
            .setStyle(ButtonStyle.Danger)
    ]
}

/**
 *  Delete the previous post and re-send it.
 * 
 * Sets the member on lfg cooldown.
 * 
 * @returns The expiration timestamp in seconds or 0 if the bump failed
 */
export async function bump_lfg_post(message: Message, post: LfgPostTable): Promise<number> {
    if (message.channel.isSendable()) { // not needed, but it makes typescript happy
        const embedData = message.embeds[0]!.toJSON(); // this is a post, guaranteed to be an embed
        const embed = EmbedBuilder.from(embedData); // build the same message
        // repost the message
        const bumpPost = await message.channel.send({
            embeds: [embed],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(lfg_post_buttons())]
        });
        // attach collector
        await lfg_post_collector(bumpPost, post);

        // update database
        await LfgSystemRepo.bumpPostMessageId(post.id, bumpPost.id);

        // delete the message safely
        if (message.deletable) {
            try {
                await message.delete();
            } catch {/* do nothing */ }
        }

        // set cooldown
        const cooldown = await LfgSystemRepo.setCooldown(post.guild_id, post.owner_id, post.game_id);
        return cooldown;
    } else {
        await errorLogHandle(new Error("bump_lfg_post was called on a non sendable message channel."));
        return 0; // the post couldn't be bumped
    }
}

/**
 * Delete the post by removing the discord message and the database row
 */
export async function delete_lfg_post(message: Message, postId: number) {
    // deleting the discord message if possible
    if (message.deletable) {
        try {
            await message.delete();
        } catch { /* unlucky, i guess it couldn't be deleted */ }
    }

    await LfgSystemRepo.deletePostById(postId);
}

export async function lfg_post_collector(message: Message, post: LfgPostTable) {
    // inner cooldown
    const cooldowns = new Collection<Snowflake, number>();
    const cd = 5;
    const collector = await message_collector<ComponentType.Button>(message,
        {
            componentType: ComponentType.Button,
            time: duration_to_seconds("6h")! * 1000, // 6 * 60 * 60_000 // 6 hours
            filter: (i) => i.user.id === post.owner_id
        },
        async (buttonInteraction) => {
            const locale = buttonInteraction.locale;
            const userCooldown = has_cooldown(post.owner_id, cooldowns, cd);
            if (userCooldown) {
                await buttonInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [embed_message("Red", t(locale, "common.button_inner_cooldown", { cooldown: userCooldown }))]
                });
                return;
            }
            setTimeout(() => cooldowns.delete(post.owner_id), cd * 1000);
            // no need to check for post owner since the collector filters for it
            switch (buttonInteraction.customId) {
                case "bump-post-button": {
                    // check for cooldown
                    const userCooldown = LfgSystemRepo.getCooldown(post.guild_id, post.owner_id, post.game_id);
                    if (userCooldown) {
                        await buttonInteraction.reply({
                            embeds: [embed_message("Red", t(locale, "common.action_on_cooldown", { cooldown: userCooldown }))],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                    const systemConfig = await LfgSystemRepo.getSystemConfigForGuild(buttonInteraction.guild!.id);
                    if ((buttonInteraction.member as GuildMember).voice.channelId === null && systemConfig.force_voice) {
                        // force voice presence
                        await buttonInteraction.reply({
                            embeds: [embed_message("Red", t(locale, "common.not_in_voice"))],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    const expiresAt = await bump_lfg_post(message, post); // BUMP
                    if (expiresAt === 0) {
                        await buttonInteraction.reply({
                            embeds: [
                                embed_error(t(locale, "systems.lfg.interface_manager.errors.collector.bump_failed"))
                            ],
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    await buttonInteraction.reply({
                        embeds: [embed_message("Green", t(locale, "systems.lfg.interface_manager.bump_button.success", { cooldown: expiresAt }))],
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }
                case "delete-post-button": {
                    await delete_lfg_post(message, post.id);
                    await buttonInteraction.reply({
                        embeds: [embed_message("Green", t(locale, "systems.lfg.interface_manager.delete_button.success"))],
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }
            }
        },
        async () => {
            if (message.deletable) {
                try {
                    await LfgSystemRepo.deletePostBySnowflake(message.id);
                    await message.delete();
                } catch { /* do nothing */ }
            }
        }
    );

    return collector;
}

export async function lfg_post_builder(
    interaction: ChatInputCommandInteraction<CacheType>
        | ButtonInteraction<CacheType>
        | StringSelectMenuInteraction<CacheType>,
    guild: Guild,
    member: GuildMember,
    game: LfgGameTable,
    lfgChannel: LfgChannelTable
) {
    // fetch channel object
    const channel = await fetchGuildChannel(guild, lfgChannel.discord_channel_id!);
    const locale = interaction.locale;
    if (!(channel instanceof TextChannel)) {
        await interaction.reply({
            embeds: [embed_error(t(locale, "systems.lfg.interface_manager.errors.post_builder.selected_channel"))],
            flags: MessageFlags.Ephemeral
        });
        return;
    }
    // the order of the modal elements:
    // 1- gamemode; 2- how many players for the gamemode; 3- What roles (optional); 4- What ranks (optional); 5- Additional info (optional)
    // if the game doesn't have roles or ranks, they won't be added to the modal
    // a minimum modal would be composed of 1, 2 and 5

    const modal = new ModalBuilder().setCustomId("post-modal").setTitle("Post Builder");

    // fetching the attached gamemodes
    const gamemodes = await LfgSystemRepo.getChannelGamemodesBySnowflake(channel.id);
    if (gamemodes.length) {
        // if there are gamemodes attached to the channel, add a select menu component to the modal
        modal.addLabelComponents(select_gamemode_label(gamemodes, locale));
    }

    // add slots input
    modal.addLabelComponents(slots_label(locale));

    // ranks and roles
    const gameRoles = await LfgSystemRepo.getGameRoles(game.id);
    if (gameRoles.length) {
        const roles = await resolveSnowflakesToRoles(guild, gameRoles.map(row => row.role_id));
        if (roles.length) modal.addLabelComponents(select_roles_label(roles, locale));
    }

    const gameRanks = await LfgSystemRepo.getGameRanks(game.id);
    if (gameRanks.length) {
        const ranks = await resolveSnowflakesToRoles(guild, gameRanks.map(row => row.role_id));
        if (ranks.length) modal.addLabelComponents(select_rank_label(ranks, locale));
    }

    // additional details
    modal.addLabelComponents(add_details_label(locale));

    await interaction.showModal(modal);
    try {
        const submit = await interaction.awaitModalSubmit({
            time: 300_000,
            filter: (i) => i.user.id === interaction.user.id
        });
        await submit.deferReply({ flags: MessageFlags.Ephemeral });
        // slots validates if the input is a number
        const slots = Number(submit.fields.getTextInputValue("slots-input"));
        if (Number.isNaN(slots) || slots < 1) {
            await submit.editReply({ embeds: [embed_error(t(locale, "systems.lfg.posts.invalid.slots"), t(locale, "common.invalid_input"))] });
            return;
        }

        // additional info validates for bad words
        const additionalInfo = submit.fields.getTextInputValue("details-input");
        const localTriggers = Object.values(local_config.rules.toxic_pattern).flat();
        const badName = await hasBlockedContent(additionalInfo, localTriggers, guild);
        if (badName) {
            await submit.editReply({ embeds: [embed_error(t(locale, "common.bad_word_usage.description"), t(locale, "common.bad_word_usage.title"))] })
            return;
        }

        // fetch the gamemode if the channel has any attached
        let selectedGamemode = game.game_name;
        if (gamemodes.length) {
            selectedGamemode = submit.fields.getStringSelectValues("select-gamemode-menu")[0]!; // the select menu is required and ensured a single selection
        }

        // fetch the roles if any was selected
        let rolesSelected: Role[] = [];
        let roleIdsSelected: string[] = [];
        if (gameRoles.length) {
            roleIdsSelected = Array.from(submit.fields.getStringSelectValues("select-roles-menu"));
            if (roleIdsSelected.length) rolesSelected = await resolveSnowflakesToRoles(guild, roleIdsSelected);
        }

        let ranksSelected: Role[] = [];
        let rankIdsSelected: string[] = []
        if (gameRanks.length) {
            rankIdsSelected = Array.from(submit.fields.getStringSelectValues("select-ranks-menu"));
            if (rankIdsSelected.length) ranksSelected = await resolveSnowflakesToRoles(guild, rankIdsSelected);
        }


        const guildEmojis = await guild.emojis.fetch();

        const stringRoles = stringifyRoles(rolesSelected, guildEmojis);
        const stringRanks = stringifyRoles(ranksSelected, guildEmojis);

        const postMessage = await channel.send({
            embeds: [
                embed_lfg_post(
                    member,
                    selectedGamemode,
                    slots,
                    additionalInfo,
                    stringRanks,
                    stringRoles,
                    guild.preferredLocale // posts are in guild's language
                )
            ],
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(...lfg_post_buttons())]
        });
        const lfgLogs = await fetchLogsChannel(guild, "lfg-logs");
        if (lfgLogs) { // log the event if logs are set up
            await lfgLogs.send({
                embeds: [
                    embed_lfg_post_log(
                        member,
                        game.game_name,
                        selectedGamemode,
                        slots,
                        additionalInfo,
                        stringRanks,
                        stringRoles
                    )
                ]
            });
        }

        // handle the case where an active post already exists
        const deletePostOnLFG = async () => {
            try {
                const post = await fetchPostMessage(guild, game.id, member.id);
                if (post) {
                    // if there is a post already, delete it
                    try {
                        await post.message.delete();
                    } catch {/* do nothing */ }
                    await LfgSystemRepo.deletePostById(post.post.id);

                }
            } catch {/* do nothing */ }
        }
        await deletePostOnLFG();

        // register post
        const gamemodeId = gamemodes.find((row) => row.name === selectedGamemode)?.id ?? null;
        const lfgPostObject: LfgPost = {
            guild_id: guild.id,
            game_id: game.id,
            channel_id: lfgChannel.id,
            gamemode_id: gamemodeId,
            message_id: postMessage.id,
            owner_id: member.id,
            description: additionalInfo ? additionalInfo : null,
            slots: slots,
            created_at: timestampNow()
        }

        // discord snowflakes for roles and ranks 
        const selectedSnowflakes = new Set([...rolesSelected, ...ranksSelected].map(r => r.id));
        const lfgPostFull: LfgPostAndRoleIds = {
            post: lfgPostObject,
            attachedRoleIds: [...gameRoles, ...gameRanks]
                .filter(r => selectedSnowflakes.has(r.role_id))
                .map(r => r.id)
        }
        const lfgPostTable = await LfgSystemRepo.registerPost(lfgPostFull);

        // attach the collector to the lfg post
        await lfg_post_collector(postMessage, lfgPostTable);

        const expiresTimestamp = await LfgSystemRepo.setCooldown(guild.id, member.id, game.id); // put poster on cooldown
        await submit.editReply({
            embeds: [
                embed_message("Green", t(locale, "systems.lfg.interface_manager.lfg_button.success", { channel: `${channel}`, cooldown: expiresTimestamp }))
            ]
        });
    } catch (error) {
        console.error(error);
        await interaction.followUp({ flags: MessageFlags.Ephemeral, embeds: [embed_interaction_expired(locale)] });
    }
}

/**
 * @returns The post as message object and the database row or null if there is no post in the database to match
 * @throws Errors if the fetch fails to get the channel or the message object 
 */
export async function fetchPostMessage(
    guild: Guild,
    gameId: number,
    ownerId: string
): Promise<{ message: Message, post: LfgPostWithChannelTable } | null> {
    const postRow = await LfgSystemRepo
        .getPostWithChannelByOwner(guild.id, gameId, ownerId);

    if (!postRow) return null;

    // fetch the channel object
    const lfgChannel = await fetchGuildChannel(guild, postRow.discord_channel_id);
    if (!(lfgChannel instanceof TextChannel)) throw new Error("Failed to fetch the channel of the post...");

    // fetch the message object
    const message = await fetchMessage(lfgChannel, postRow.message_id);
    if (!message) throw new Error("Failed to fetch the message of the post...");

    return { message: message, post: postRow };
}