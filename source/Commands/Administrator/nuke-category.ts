import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CategoryChannel, ChannelSelectMenuBuilder, ChannelType, ComponentType, GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { fetchGuildChannel, message_collector } from "../../utility_modules/discord_helpers.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";

const nuke_category: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("nuke-category")
        .setDescription("Erase an entire category. Only for the server owner.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),

    async execute(interaction) {
        const member = interaction.member as GuildMember;
        const guild = member.guild;

        if (member.id !== guild.ownerId) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [embed_error(`Only <@${guild.ownerId}> can use this command as they are the guild owner.`)]
            });
            return;
        }

        const categoryCount = guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildCategory).size;
        if (categoryCount < 1) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                embeds: [embed_error("There are no categories cached for this guild.\nThere is nothing to be deleted.")]
            });
            return;
        }

        const select = new ChannelSelectMenuBuilder()
            .setChannelTypes(ChannelType.GuildCategory)
            .setCustomId("select-category")
            .setMinValues(1)
            .setMaxValues(categoryCount)
            .setPlaceholder("Select the categories to be nuked...");

        const selectActionRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select);

        const nukeButton = new ButtonBuilder()
            .setCustomId("nuke-button")
            .setLabel("NUKE")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🚀");

        const buttonActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(nukeButton);

        await interaction.reply({
            embeds: [
                embed_message(
                    "Red",
                    "Nuking a category will permanently delete it, its channels and their contents.",
                    "Select the categories to be nuked"
                )
            ],
            components: [selectActionRow]
        });

        const reply = await interaction.fetchReply();
        const categoriesSelected: CategoryChannel[] = [];

        const selectCollector = await message_collector<ComponentType.ChannelSelect>(
            reply,
            {
                componentType: ComponentType.ChannelSelect,
                time: 120_000,
                filter: (i) => i.user.id === member.id
            },
            async (selectInteraction) => {
                for (const id of selectInteraction.values) {
                    const category = await fetchGuildChannel(guild, id) as CategoryChannel;
                    categoriesSelected.push(category);
                }

                await selectInteraction.reply({
                    embeds: [
                        embed_message("Red", `${categoriesSelected.join(" ")}\nSelected to be nuked!`)
                    ]
                });

                await reply.edit({
                    embeds: [
                        embed_message(
                            "Red",
                            `Proceed with nuking the categories and their channels by pressing the button.\nCategories to be nuked: ${categoriesSelected.join(", ")}`)
                    ],
                    components: [buttonActionRow]
                });
            },
            async () => {
                try {
                    await reply.delete();
                } catch (error) {
                    await errorLogHandle(error);
                }
            }
        );

        await message_collector<ComponentType.Button>(
            reply,
            {
                componentType: ComponentType.Button,
                time: 120_000,
                filter: (i) => i.user.id === member.id
            },
            async (buttonInteraction) => {
                await buttonInteraction.deferReply();

                for (const category of categoriesSelected) { // iterate through categories to be deleted
                    for (const child of category.children.cache.values()) { // iterate through each channel child
                        if (child.id === buttonInteraction.channelId) continue; // skip the channel if this command is run inside the category to be nuked
                        try {
                            await child.delete();
                        } catch (error) {
                            await errorLogHandle(error);
                        }
                    }

                    try {
                        await category.delete();
                    } catch (error) {
                        await errorLogHandle(error);
                    }
                }

                try { // the command might be called inside one of the categories to be deleted
                    await buttonInteraction.editReply({
                        embeds: [embed_message("Red", "Nuke complete!")]
                    });
                } catch { /* do nothing */ }

                selectCollector.stop();
            },
            async () => { }
        )
    },
    metadata: {
        cooldown: 60,
        userPermissions: [PermissionFlagsBits.Administrator],
        botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
        scope: "global",
        category: "Administrator",
        group: "global"
    }
}

export default nuke_category;