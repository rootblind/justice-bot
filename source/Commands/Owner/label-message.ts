import { APISelectMenuOption, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, TextInputStyle } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import { LabelBuilder, ModalBuilder, RestOrArray, StringSelectMenuBuilder, TextInputBuilder } from "@discordjs/builders";
import { LabelsClassification } from "../../Interfaces/helper_types.js";
import { handleModalCatch } from "../../utility_modules/discord_helpers.js";
import { csv_append } from "../../utility_modules/utility_methods.js";
import { curate_text } from "../../utility_modules/curate_data.js";
import { local_config } from "../../objects/local_config.js";
import { embed_message } from "../../utility_modules/embed_builders.js";

const labelMessageCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("label-message")
        .setDescription("Add a message to the dataset.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),

    metadata: {
        cooldown: 5,
        ownerOnly: true,
        userPermissions: [],
        botPermissions: [],
        group: "global",
        scope: "global",
        category: "Owner"
    },
    async execute(interaction) {
        // open a modal to input the text and select the labels
        const messageInput = new TextInputBuilder()
            .setCustomId("message-input")
            .setMinLength(3)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        const messageLabel = new LabelBuilder()
            .setLabel("Message")
            .setDescription("The message to be labeled.")
            .setTextInputComponent(messageInput);

        const flagTags: LabelsClassification = {
            "OK": 0,
            "Aggro": 0,
            "Violence": 0,
            "Sexual": 0,
            "Hateful": 0
        }

        const tags = Object.keys(flagTags);
        const selectMenuOptions: RestOrArray<APISelectMenuOption> = [];
        tags.forEach((tag) => {
            selectMenuOptions.push({
                label: tag,
                description: `Flag as ${tag}`,
                value: tag
            });
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("select-label")
            .setMinValues(1)
            .setMaxValues(tags.length)
            .setPlaceholder("Pick the labels...")
            .addOptions(selectMenuOptions)
            .setRequired(true);

        const selectMenuLabel = new LabelBuilder()
            .setLabel("Select label")
            .setStringSelectMenuComponent(selectMenu);

        const modal = new ModalBuilder()
            .setCustomId("modal-label-message")
            .setTitle("Label message")
            .addLabelComponents(messageLabel, selectMenuLabel);

        await interaction.showModal(modal);
        try {
            const submit = await interaction.awaitModalSubmit({
                filter: (i) => i.user.id === interaction.user.id,
                time: 300_000
            });

            const message = submit.fields.getTextInputValue("message-input");
            const filterPatterns = [
                /<:(\d+):>/g,
                /[^a-zA-Z -]/g,
                /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g
            ];
            const filteredText = curate_text(message, filterPatterns);

            if (!filteredText) {
                await submit.reply({
                    content: 'The input is invalid. The text must have alphabetical characters and must not be only a link.',
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            const selectedLabels = submit.fields.getStringSelectValues("select-label");

            if (selectedLabels.includes("OK")) {
                flagTags["OK"] = 1;
            } else {
                selectedLabels.forEach((label) => {
                    flagTags[label] = 1;
                });
            }

            csv_append(filteredText, flagTags, local_config.sources.flag_data);
            await submit.reply({
                embeds: [
                    embed_message("Green",
                        "**Content**: " + message
                    )
                        .setFields({
                            name: "Labels",
                            value: selectedLabels.join(", ")
                        })
                ],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            await handleModalCatch(error, interaction);
        }
    }
}

export default labelMessageCommand;