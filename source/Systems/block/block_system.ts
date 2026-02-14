import { ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } from "@discordjs/builders";
import {
    AnySelectMenuInteraction,
    ButtonInteraction,
    CacheType,
    ChatInputCommandInteraction,
    ComponentType,
    Guild,
    GuildMember,
    Message,
    MessageFlags
} from "discord.js";
import { anyBots, anyStaff, fetchGuildMember, message_collector } from "../../utility_modules/discord_helpers.js";
import BlockSystemRepo from "../../Repositories/blocksystem.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";

export function select_block_row() {
    const selectUsersBlock = new UserSelectMenuBuilder()
        .setCustomId("select-users-block")
        .setPlaceholder("Select members to be blocked...")
        .setMinValues(1)
        .setMaxValues(5)

    return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectUsersBlock);
}

export async function add_block_collector(
    message: Message,
    member: GuildMember,
    interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType> | AnySelectMenuInteraction<CacheType>
): Promise<string[]> {
    return new Promise((resolve) => {
        const guild = member.guild;
        const blockedIds: string[] = [];
        const collector = message_collector<ComponentType.UserSelect>(
            message,
            {
                componentType: ComponentType.UserSelect,
                time: 120_000,
                filter: (i) => i.user.id === member.id
            },
            async (selectInteraction) => {
                if (selectInteraction.customId !== "select-users-block") return;
                const blockedCount = await BlockSystemRepo.blockedByMemberCount(guild.id, member.id);
                if (blockedCount >= 32) {
                    await selectInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [
                            embed_error(
                                "Your blocked list is full!\nYou can make room by unblocking some users.",
                                "Maximum amount of blocked users reached [32/32]"
                            )
                        ]
                    });
                    (await collector).stop();
                    return;
                }

                if (selectInteraction.values.includes(member.id)) {
                    await selectInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_error("You can not target yourself!")]
                    });
                    (await collector).stop();
                    return;
                }

                const botSelected = await anyBots(guild, selectInteraction.values);
                if (botSelected) {
                    await selectInteraction.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_error("You can not block BOTS!")]
                    });
                    (await collector).stop();
                    return;
                }

                const staffSelected = await anyStaff(guild, selectInteraction.values);
                if (staffSelected) {
                    await selectInteraction.reply({
                        embeds: [embed_error("You can not target staff members!")],
                        flags: MessageFlags.Ephemeral
                    });
                    (await collector).stop();
                    return;
                }

                for (const id of selectInteraction.values) {
                    await BlockSystemRepo.addBlock(guild.id, member.id, id);
                    blockedIds.push(id);
                }

                const userTags = selectInteraction.values.map(id => `<@${id}>`).join(" ");
                await selectInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [
                        embed_message(
                            "Green",
                            `User(s) ${userTags} blocked.`,
                            `Blocked [${blockedCount + selectInteraction.values.length}/32]`
                        )
                    ]
                });
                (await collector).stop();
            },
            async () => {
                if (interaction.replied) await interaction.deleteReply();
                resolve(blockedIds);
            }
        );

        return blockedIds;
    });
}

export async function select_unblock_builder(guild: Guild, blocklistIds: string[]) {
    // convert ids to usernames if possible
    const users = await Promise.all(blocklistIds.map(async (id) => {
        const member = await fetchGuildMember(guild, id);
        if (member instanceof GuildMember) return { username: member.user.username, id: id };
        return { id: id };
    })
    );

    const options = users.map(user => {
        return {
            label: user.username ?? user.id,
            value: user.id,
            description: `Unblock ${user.username ?? user.id}`
        }
    });
    const select = new StringSelectMenuBuilder()
        .setCustomId("select-users-unblock")
        .setPlaceholder("Select the users to be unblocked...")
        .setMinValues(1)
        .setMaxValues(options.length < 5 ? options.length : 5)
        .addOptions(options);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export async function remove_block_collector(
    message: Message,
    member: GuildMember,
    interaction: ChatInputCommandInteraction<CacheType> | ButtonInteraction<CacheType> | AnySelectMenuInteraction<CacheType>
): Promise<string[]> {
    return new Promise((resolve) => {
        const guild = member.guild;
        const unblockedIds: string[] = [];

        const collector = message_collector<ComponentType.StringSelect>(
            message,
            {
                componentType: ComponentType.StringSelect,
                time: 120_000,
                filter: (i) => i.user.id === member.id
            },
            async (selectInteraction) => {
                if (selectInteraction.customId !== "select-users-unblock") return;
                for (const id of selectInteraction.values) {
                    await BlockSystemRepo.removeBlock(guild.id, member.id, id);
                    unblockedIds.push(id);
                }

                const userTags = selectInteraction.values.map(id => `<@${id}>`).join(" ");
                await selectInteraction.reply({
                    flags: MessageFlags.Ephemeral,
                    embeds: [embed_message("Green", `Removed from blocklist: ${userTags}`)]
                });
                (await collector).stop();
            },
            async () => {
                if (interaction.replied) await interaction.deleteReply()
                resolve(unblockedIds);
            }
        );
    });
}