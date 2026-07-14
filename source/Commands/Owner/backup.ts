import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    PermissionFlagsBits,
    SlashCommandBuilder
} from "discord.js";
import { ChatCommand } from "../../Interfaces/command.js";
import fs from "fs/promises";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { createBackupDump } from "../../utility_modules/utility_methods.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import cron, { ScheduledTask } from "node-cron";
import { CronString } from "../../Interfaces/helper_types.js";
import BotConfigRepo from "../../Repositories/botconfig.js";
import { build_cron } from "../../utility_modules/cronHandler.js";
import { message_collector } from "../../utility_modules/discord_helpers.js";
import path from "path";
import archiver from "archiver";
import { createWriteStream } from "fs";

let schedule: ScheduledTask | null = null; // declaring the schedule here for session persistence


const backupCommand: ChatCommand = {
    data: new SlashCommandBuilder()
        .setName("backup")
        .setDescription("Database backup commands.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName("now")
                .setDescription("Initiate a backup right away.")
        )
        .addSubcommand(subcommand =>
            subcommand.setName("clear")
                .setDescription("Wipe the backup directory.")
        )
        .addSubcommand(subcommand =>
            subcommand.setName("dump")
                .setDescription("Archive all backups and send it in the current channel.")
        )
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup.setName("schedule")
                .setDescription("Manage the backup schedule.")
                .addSubcommand(subcommand =>
                    subcommand.setName("set")
                        .setDescription("Set the backup schedule.")
                        .addStringOption(option =>
                            option.setName("cron-expression")
                                .setDescription("The cron expression to set the backup schedule.")
                                .setRequired(true)
                                .setMinLength(9)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName("stop")
                        .setDescription("Stop the backup scheduler.")
                )
        )
        .toJSON(),
    metadata: {
        userPermissions: [],
        botPermissions: [],
        cooldown: 1, // testing 
        group: "global",
        scope: "global",
        category: "Owner",
        ownerOnly: true
    },
    async execute(interaction) {
        const options = interaction.options;
        const subcommand = options.getSubcommand();

        const dirPath = "./backup-db"; // the backup directory path
        const dumpFiles = (await fs.readdir(dirPath)).map(file => file);
        await interaction.deferReply();

        if ((subcommand === "clear" || subcommand === "dump") && dumpFiles.length === 0) {
            // these commands can not be ran while there are no backup dumps
            await interaction.editReply({
                embeds: [embed_message("Red", "The backup directory is empty.")]
            });
            return;
        }

        switch (subcommand) {
            case "now": {
                try {
                    const dumpFile = await createBackupDump();
                    await interaction.editReply({
                        embeds: [embed_message("Green", `Backup file: ${dumpFile.fileName}`)]
                    });
                } catch (error) {
                    await errorLogHandle(error);
                    await interaction.editReply({
                        embeds: [
                            embed_error("Backup failed!")
                        ]
                    });
                }
                break;
            }
            case "set": {
                const cronExpression = options.getString("cron-expression", true);
                if (!cron.validate(cronExpression)) {
                    // passing this guarantees cronExpression to be CronString valid
                    await interaction.editReply({
                        embeds: [
                            embed_message(
                                "Red",
                                "The cron expression provided is invalid, a cron expression must look something like: `* * * * *`",
                                "Invalid cron expression"
                            )
                        ]
                    });
                    return;
                }

                const backup_db_schedule = await BotConfigRepo.getBackupSchedule();
                if (backup_db_schedule) {
                    if (schedule) schedule.stop();
                }

                schedule = build_cron({
                    name: "Backup scheduler",
                    schedule: cronExpression as CronString,
                    job: async () => {
                        try {
                            await createBackupDump();
                        } catch (error) {
                            await errorLogHandle(error);
                        }
                    },
                    runCondition: async () => true

                });
                schedule.start();
                await BotConfigRepo.updateBackupSchedule(cronExpression as CronString);
                await interaction.editReply({
                    embeds: [
                        embed_message("Green", `Expression: \`${cronExpression}\``, "Backup scheduler set")
                    ]
                });
                break;
            }
            case "stop": {
                const backupSchedule = await BotConfigRepo.getBackupSchedule();
                if (backupSchedule && schedule) {
                    schedule.stop();
                    await BotConfigRepo.updateBackupSchedule(null);
                    await interaction.editReply({
                        embeds: [
                            embed_message("Green", "The Backup scheduler was stopped...", "Backup Scheduler removed")
                        ]
                    });
                } else {
                    await interaction.editReply({
                        embeds: [
                            embed_message("Green", "There is no backup scheduler active at this moment...")
                        ]
                    });
                }
                break;
            }
            case "clear": {
                const clearButton = new ButtonBuilder()
                    .setCustomId('clear-button')
                    .setLabel('Clear')
                    .setStyle(ButtonStyle.Danger)
                const clearRow = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton);

                await interaction.editReply({
                    embeds: [
                        embed_message(
                            "Red",
                            `You are trying to clean \`${dumpFiles.length}\` database backup files!\nPress the button to confirm`,
                            "Attention!"
                        )
                    ],
                    components: [clearRow]
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
                        try {
                            const files = await fs.readdir(dirPath);
                            for (const file of files) {
                                await fs.unlink(path.join(dirPath, file));
                            }

                            if (files.length) {
                                await buttonInteraction.editReply({
                                    embeds: [embed_message("Green", `${files.length} files were deleted.`)]
                                });
                            } else {
                                await buttonInteraction.editReply({
                                    embeds: [embed_message("Green", "The backup directory is empty, there is nothing to delete.")]
                                });
                            }
                        } catch (error) {
                            await errorLogHandle(error);
                            await interaction.editReply({
                                embeds: [embed_error("An error occured while clearing the backup directory.")]
                            });
                        }

                        (await collector).stop();
                    },
                    async () => {
                        try {
                            await reply.delete()
                        } catch { /* do nothing */ }
                    }
                )
                break;
            }
            case "dump": {
                const dumpButton = new ButtonBuilder()
                    .setCustomId('dump-button')
                    .setLabel('Dump')
                    .setStyle(ButtonStyle.Danger);
                const dumpRow = new ActionRowBuilder<ButtonBuilder>().addComponents(dumpButton);

                await interaction.editReply({
                    embeds: [
                        embed_message(
                            "Red",
                            "You are trying to create a dump zip of the database backup files on this channel!\n" +
                            "Make sure to run this command in a private channel.\nProceed by pressing the button."
                        )
                    ],
                    components: [dumpRow]
                });

                const reply = await interaction.fetchReply();
                const collector = message_collector<ComponentType.Button>(reply,
                    {
                        componentType: ComponentType.Button,
                        time: 600_000,
                        filter: (i) => i.user.id === interaction.user.id
                    },
                    async (buttonInteraction) => {
                        if (dumpFiles.length === 0) {
                            await buttonInteraction.reply({
                                embeds: [
                                    embed_message("Green", "The backup directory is empty, there is nothing to be dumped.")
                                ]
                            });
                            return;
                        }

                        await buttonInteraction.deferReply();

                        try {
                            const archivePath = "./temp/backup_dump.tar";
                            const outputStream = createWriteStream(archivePath);
                            const archive = archiver("tar");
                            archive.on("error", (error) => { throw error; });
                            archive.directory(dirPath, false);
                            archive.pipe(outputStream);

                            await new Promise<void>((resolve, reject) => {
                                outputStream.on("close", resolve);
                                outputStream.on("end", resolve);
                                archive.on("error", reject);
                                outputStream.on("error", reject);
                                archive.finalize().catch(reject);
                            });

                            await buttonInteraction.editReply({
                                embeds: [
                                    embed_message("Green",
                                        `Database dump size: ${archive.pointer()} bytes.`
                                    )
                                ],
                                files: [archivePath]
                            });

                            // cleanup
                            await fs.unlink(archivePath);
                        } catch (error) {
                            await errorLogHandle(error);
                            await buttonInteraction.editReply({
                                embeds: [embed_error("Something failed while archiving the dump.")]
                            });
                        }

                        (await collector).stop();
                    },
                    async () => {
                        try {
                            await reply.delete();
                        } catch { /* do nothing */ }
                    }
                );

            }
        }
    }
}

export default backupCommand;