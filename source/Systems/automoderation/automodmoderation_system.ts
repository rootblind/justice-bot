import {
    ActionRowBuilder,
    ButtonInteraction,
    CacheType,
    ComponentType,
    Guild,
    InteractionCollector,
    MessageComponentInteraction,
    MessageFlags,
    StringSelectMenuBuilder,
    type Message
} from "discord.js";
import { fetchLogsChannel, message_collector } from "../../utility_modules/discord_helpers.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";
import type {
    ClassifierResponse,
    CollectorFilterCustom,
    LabelsClassification
} from "../../Interfaces/helper_types.js";
import { csv_append } from "../../utility_modules/utility_methods.js";
import { embed_adjust_flags, embed_justicelogs_flagged_message } from "../../utility_modules/embed_builders.js";

export async function attach_flagged_message_collector(message: Message, response: ClassifierResponse)
    : Promise<InteractionCollector<ButtonInteraction<CacheType>>> {
    const guild = message.guild as Guild;
    const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guild.id);
    const justiceLogs = await fetchLogsChannel(guild, "justice-logs");

    const filter: CollectorFilterCustom = (i: MessageComponentInteraction<CacheType>) => {
        if (!i.inCachedGuild()) return false;
        if (!staffRoleId) return false;
        return i.member.roles.cache.has(staffRoleId);
    }

    const flagTags: LabelsClassification = {
        "OK": 0,
        "Aggro": 0,
        "Violence": 0,
        "Sexual": 0,
        "Hateful": 0
    }

    let embed_labels: string[] = [];

    const buttonCollector = await message_collector<ComponentType.Button>(
        message,
        {
            componentType: ComponentType.Button,
            filter: filter,
        },
        async (buttonInteraction) => {
            await buttonInteraction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            switch (buttonInteraction.customId) {
                case "confirm":
                    for (const label of response.labels) {
                        if (label === "OK") {
                            flagTags["OK"] = 1;
                            break;
                        }
                        flagTags[label] = 1;
                    }
                    embed_labels = response.labels;
                    await buttonInteraction.editReply({
                        content: `Confirmed labels: ${response.labels.join(", ")}\nMessage ID: ${message.id}`
                    });
                    csv_append(response.text, flagTags, "flag_data.csv");
                    break;
                case "adjust": {
                    const tags = ["Aggro", "Violence", "Sexual", "Hateful"];
                    const selectMenuOptions = [];
                    for (const label of tags) {
                        selectMenuOptions.push({
                            label: label,
                            value: label,
                            description: `Flag as ${label}`
                        })
                    }
                    const selectFlagsMenu = new StringSelectMenuBuilder()
                        .setCustomId("select-flags-menu")
                        .setPlaceholder("Adjust with the correct flags.")
                        .setMinValues(1)
                        .setMaxValues(selectMenuOptions.length)
                        .addOptions(selectMenuOptions)

                    const acitonRow = new ActionRowBuilder<StringSelectMenuBuilder>()
                        .addComponents(selectFlagsMenu);

                    await buttonInteraction.editReply({
                        components: [acitonRow],
                        embeds: [embed_adjust_flags()]
                    });

                    const selectFlagsReply = await buttonInteraction.fetchReply();

                    const selectCollector = await message_collector<ComponentType.StringSelect>(
                        selectFlagsReply,
                        {
                            componentType: ComponentType.StringSelect,
                            lifetime: 300_000
                        },
                        async (selectInteraction) => {
                            for(const label of selectInteraction.values) {
                                flagTags[label] = 1;
                            }
                            await selectInteraction.reply({
                                flags: MessageFlags.Ephemeral,
                                content: `The flags were adjusted to ${selectInteraction.values.join(", ")}\nMessage ID: ${message.id}`
                            });
                            embed_labels = selectInteraction.values;
                            selectCollector.stop();
                        },
                        async () => {
                            try {
                                await selectFlagsReply.delete();
                            } catch {/* Do nothing */}

                            csv_append(response.text, flagTags, "flag_data.csv");
                            buttonCollector.stop();
                        }
                    );
                    break;
                }
                case "false-positive":
                    flagTags["OK"] = 1;
                    await buttonInteraction.editReply({
                        content: `You have flagged this message as being OK as the flags were a false positive.\nMessage ID: ${message.id}`
                    });
                    csv_append(response.text, flagTags, "flag_data.csv");
                    buttonCollector.stop();
                break;
            }

            if(justiceLogs) {
                await justiceLogs.send({
                    embeds: [ 
                        embed_justicelogs_flagged_message(
                            message,
                            buttonInteraction.user,
                            embed_labels,
                            buttonInteraction.customId as "confirm" | "adjust" | "false-positive"
                        )
                    ]
                });
            }
        },
        async () => {
            await message.edit({components: []});
        }
    )

    return buttonCollector
}