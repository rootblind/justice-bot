import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import fs from "fs/promises";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";
import { local_config } from "../../objects/local_config.js";
import path from "path";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { archive_directory, timestampNow } from "../../utility_modules/utility_methods.js";

const errorsCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("errors")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDescription("Dump and clear errors.")
        .toJSON(),
    metadata: {
        userPermissions: [],
        botPermissions: [],
        cooldown: 10,
        group: "global",
        category: "Owner",
        ownerOnly: true,
        scope: "global"
    },
    async execute(interaction) {
        const errorDir = local_config.sources.error_dumps;
        const errorFiles = await fs.readdir(errorDir);

        if (errorFiles.length - 1 < 1) { // exclude error.log from the count
            await interaction.reply({
                embeds: [embed_message("Aqua", "No error dumps found.")],
                flags: MessageFlags.Ephemeral
            });

            return;
        }

        const embed = new EmbedBuilder()
            .setColor("Aqua")
            .setTitle('Error dumps found')
            .setDescription(`Found \`${errorFiles.length}\` files.\n`)
            .setFields(
                {
                    name: 'Clear',
                    value: "Clears the dump directory"
                },
                {
                    name: "Dump",
                    value: "Dumps the archive of all logs in the currect text channel."
                }
            );

        const clearButton = new ButtonBuilder()
            .setCustomId('clear-button')
            .setLabel('Clear')
            .setStyle(ButtonStyle.Danger)

        const dumpButton = new ButtonBuilder()
            .setCustomId('dump-button')
            .setLabel('Dump')
            .setStyle(ButtonStyle.Secondary)

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(clearButton, dumpButton);

        await interaction.reply({
            embeds: [embed],
            components: [actionRow]
        });

        const reply = await interaction.fetchReply();
        const collector = message_collector<ComponentType.Button>(reply,
            {
                componentType: ComponentType.Button,
                time: 600_000,
                filter: (i) => i.user.id === interaction.user.id
            },
            async (buttonInteraction) => {
                await buttonInteraction.deferReply();
                if (buttonInteraction.customId === "clear-button") {
                    try {
                        for (const file of errorFiles) {
                            await fs.unlink(path.join(errorDir, file));
                        }
                        await buttonInteraction.editReply({
                            embeds: [
                                embed_message("Green", `All **${errorFiles.length}** error dumps have been deleted.`)
                            ]
                        });
                    } catch (error) {
                        await errorLogHandle(error);
                        await buttonInteraction.editReply({
                            embeds: [
                                embed_error(`An error occured while trying to delete one of the following files: ${errorFiles.join(", ")}`)
                            ]
                        });
                    }

                    (await collector).stop();
                } else if (buttonInteraction.customId === "dump-button") {
                    try {
                        const archivePath = `${local_config.sources.temp}/error_dump_${timestampNow()}.tar`;
                        const archiveOutput = await archive_directory(local_config.sources.error_dumps, archivePath);
                        await buttonInteraction.editReply({
                            embeds: [
                                embed_message(
                                    "Green",
                                    `Error logs were zipped for a total of ${archiveOutput.byte_size} bytes.`,
                                    "⚙ Dumping error logs..."
                                )
                            ],
                            files: [archiveOutput.output_path]
                        });

                        // cleaning the archive
                        await fs.unlink(archiveOutput.output_path);
                    } catch (error) {
                        await errorLogHandle(error);
                        await buttonInteraction.editReply({
                            embeds: [embed_error("Something went wrong while trying to dump the error files.")]
                        });
                    }

                    dumpButton.setDisabled(true);
                    await reply.edit({ components: [actionRow] });
                }
            },
            async () => {
                try {
                    await reply.delete();
                } catch { /* do nothing */ }
            }
        )
    }
}

export default errorsCommand;