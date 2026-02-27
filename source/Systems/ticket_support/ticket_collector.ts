import {
    ActionRowBuilder,
    ButtonBuilder,
    ComponentType,
    EmbedBuilder,
    Guild,
    GuildMember,
    GuildPremiumTier,
    LabelBuilder,
    Message,
    MessageCreateOptions,
    MessageFlags,
    ModalBuilder,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
    User,
    UserSelectMenuBuilder
} from "discord.js";
import {
    channel_scrapper,
    DiscordChannelScrapperResponse,
    fetchGuildMember,
    fetchLogsChannel,
    handleModalCatch,
    message_collector
} from "../../utility_modules/discord_helpers.js";
import { ensureDirectory, downloadFileHTTP, duration_to_seconds, deleteDirectoryRecursive, timestampNow } from "../../utility_modules/utility_methods.js";
import TicketSystemRepo from "../../Repositories/ticketsystem.js";
import { embed_error, embed_message } from "../../utility_modules/embed_builders.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { add_member_button, claim_button, remove_member_button, resolve_button } from "../../utility_modules/button_builders.js";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import archiver from "archiver";

function resolveInputLabel(): LabelBuilder {
    const reasonInput = new TextInputBuilder()
        .setCustomId("resolve-input")
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(4)
        .setMaxLength(1024)
        .setPlaceholder("Enter the resolution of this ticket...")
        .setRequired(true)

    const label = new LabelBuilder()
        .setLabel("Resolution")
        .setDescription("The resolution of the ticket.")
        .setTextInputComponent(reasonInput);

    return label;
}

function select_member_modal(): ModalBuilder {
    const selectUserMenu = new UserSelectMenuBuilder()
        .setCustomId("select-member")
        .setMaxValues(1)
        .setMinValues(1)
        .setRequired(true)
    const selectUserLabel = new LabelBuilder()
        .setLabel("Select member")
        .setDescription("Select a member from the drop down menu.")
        .setUserSelectMenuComponent(selectUserMenu);
    const selectUserModal = new ModalBuilder()
        .setCustomId("select-member-modal")
        .setTitle("Ticket Members")
        .addLabelComponents(selectUserLabel)
    return selectUserModal;
}

/**
 * The embed for logging the ticket
 * 
 * @param member The member representation as a string
 */
function embed_ticket_resolution(
    moderator: User,
    member: string,
    ticketName: string,
    subject: string,
    resolution: string
) {
    return new EmbedBuilder()
        .setColor("Aqua")
        .setTitle("Ticket Closed")
        .setAuthor({
            name: `${moderator.username} resolved the ticket.`,
            iconURL: moderator.displayAvatarURL({ extension: "png" })
        })
        .addFields(
            {
                name: "Opened by",
                value: member,
                inline: true
            },
            {
                name: "Ticket name",
                value: `#${ticketName}`,
                inline: true
            },
            {
                name: "Subject",
                value: subject
            },
            {
                name: "Resolution",
                value: resolution
            }
        )
}

/**
 * The collector attached to each open ticket.
 * 
 * Claim and resolve are for staff members.
 * 
 * Claim notifies the member that a staff member is looking into their ticket.
 * 
 * Resolve closes the ticket and calls the necessary actions to log the ticket.
 */
export async function ticket_collector(message: Message, staffRoleId: string, subject: string) {
    const collector = await message_collector<ComponentType.Button>(message,
        {
            componentType: ComponentType.Button,
            filter: (i) => (i.member as GuildMember).roles.cache.has(staffRoleId),
            time: duration_to_seconds("7d")! * 1000 // a ticket can not stay open for longer than 7 days.
        },
        async (buttonInteraction) => {
            const guild = buttonInteraction.guild as Guild;
            const moderator = buttonInteraction.member as GuildMember;
            const channel = message.channel as TextChannel;
            const ticketTable = await TicketSystemRepo.getTicketBySnowflake(message.id);
            if (!ticketTable) {
                // calling this is only possible under the message that is registered in the database
                // hardly to see how this would fail. maybe only if someone deleted the row manually from database
                await buttonInteraction.reply({
                    embeds: [embed_error("Failed to fetch the data about this ticket.\nCollector will stop.")],
                    flags: MessageFlags.Ephemeral
                });

                await errorLogHandle(
                    new Error(
                        `${guild.name} [${guild.id}] | Ticket Snowflake: ${message.id} | ` +
                        `Failed to fetch the data about this ticket while this interaction was called ` +
                        `from the ticket message collector.`
                    )
                );
                collector.stop();
                return;
            }

            // fetch the ticket member
            // member snowflake will be used as fallback otherwise
            const member: GuildMember | null = await fetchGuildMember(guild, ticketTable.member);

            if (buttonInteraction.customId === "resolve") {
                const ticketLogs = await fetchLogsChannel(guild, "ticket-support"); // fetching the logs channel
                if (!ticketLogs) {
                    await buttonInteraction.reply({
                        embeds: [embed_error("Failed to fetch the ticket logs channel, make sure it is set up.")],
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                // prompt the staff member to give a resolution reason
                const modal = new ModalBuilder()
                    .setCustomId("modal")
                    .setTitle("Resolve the ticket")
                    .setLabelComponents(resolveInputLabel())
                await buttonInteraction.showModal(modal);
                try {
                    const submit = await buttonInteraction.awaitModalSubmit({
                        time: 300_000,
                        filter: (i) => i.user.id === buttonInteraction.user.id
                    });

                    // defer the response as the process can be lengthy
                    // the channel will be deleted so defering the reply is the only way to fulfill 
                    // the discord api interaction reply obligation

                    await submit.deferReply();
                    const resolution = submit.fields.getTextInputValue("resolve-input");

                    // logging the ticket directly on discord ticket log channel
                    // a directory inside temp/ will be created with the same name as the channel
                    // messages will be logged inside a text file with references to attached images if any
                    // images will be downloaded by the bot and archived to be sent along the txt file
                    // an embed will also be sent to confirm the resolution

                    // create the directory inside temp
                    const tempLogDirectory = `temp/${channel.name}-${timestampNow()}`;
                    const messageFileLogPath = `${tempLogDirectory}/${channel.name}-${channel.id}.txt`;
                    const archivePath = `${tempLogDirectory}.tar`;

                    await ensureDirectory(tempLogDirectory);

                    // fetch all the messages inside the ticket channel
                    let ticketMessages: Message[] = [];
                    try {
                        const discordScrapperResponse: DiscordChannelScrapperResponse =
                            await channel_scrapper(
                                channel,
                                undefined,
                                (msg) => msg.author.bot === false // ignore bot messages
                            );
                        ticketMessages = discordScrapperResponse.messages;
                    } catch (error) {
                        await errorLogHandle(error);
                        await submit.editReply({
                            embeds: [embed_error("An error occured while fetching the messages from this channel.")]
                        });
                        collector.stop();
                        return;
                    }

                    const logMessageOptions: MessageCreateOptions = {
                        embeds: [
                            embed_ticket_resolution(
                                moderator.user,
                                `${member ?? ticketTable.member}`,
                                channel.name,
                                subject,
                                resolution
                            )
                        ]
                    }
                    const files: string[] = []; // array of paths to be sent as files

                    if (ticketMessages.length > 0) {
                        // stringify the contents of messages
                        let messageLogString: string = "";

                        const guildTier = guild.premiumTier;

                        // discord limits file size upload depending on the guild premium tier
                        // chunking the files of the ticket in different archives to be sent can work
                        // as a way to upload the entire batch as the limit si per file not per .send() or .reply()
                        // but for this case, the bot will limit to what it can fetch in a single file
                        // depending on the guild tier

                        const maxArchiveByteSize: Record<GuildPremiumTier, number> = {
                            0: 8_000_000, // 8MB for level 0 boost
                            1: 8_000_000, // 8MB
                            2: 50_000_000, // 50MB
                            3: 100_000_000 // 100MB
                        }
                        let currentByteSize = 0; // keep track of the total size
                        for (const ticketMessage of ticketMessages) {

                            // format message contents as: username [date] : message_content
                            messageLogString +=
                                `${ticketMessage.author.username} [${ticketMessage.createdAt}] : ${ticketMessage.content}\n`;

                            if (ticketMessage.attachments.size > 0) {
                                // if the message has attachments, mark that fact in the message log
                                messageLogString += Array.from(ticketMessage.attachments.values())
                                    .map(a => `[[${a.name}]]`)
                                    .join("\n")

                                // if the message has attachments, within the guild tier upload limit, download the images to be archived for logging
                                for (const attachment of ticketMessage.attachments.values()) {
                                    if (!attachment.contentType?.includes("image")) continue; // skip non images files

                                    if (currentByteSize + attachment.size <= maxArchiveByteSize[guildTier]) {
                                        currentByteSize += attachment.size;
                                        await downloadFileHTTP(attachment.url, `${tempLogDirectory}/${ticketMessage.id}_${attachment.name}`);
                                    }
                                }
                            }
                        }

                        if (messageLogString.length > 0) { // if there were messages to be logged, save the .txt
                            await fs.writeFile(
                                messageFileLogPath,
                                messageLogString
                            );
                            files.push(messageFileLogPath)
                        }

                        // archive the attachments saved if any
                        const outputStream = createWriteStream(archivePath);
                        const archive = archiver("tar");
                        archive.on("error", (error) => { throw error; });

                        archive.directory(tempLogDirectory, false);

                        archive.pipe(outputStream);

                        // create the archive

                        await new Promise<void>((resolve, reject) => {
                            outputStream.on("close", resolve);
                            outputStream.on("end", resolve);
                            archive.on("error", reject);
                            outputStream.on("error", reject);

                            archive.finalize().catch(reject);
                        })

                        files.push(archivePath);
                        logMessageOptions.files = files;
                    }

                    await ticketLogs.send(logMessageOptions);

                    if (files.length > 0) {
                        // clean the files
                        await Promise.all(files.map(f => fs.unlink(f).catch(() => { })));
                        await deleteDirectoryRecursive(tempLogDirectory);
                    }
                    // delete the channel and clean the database row
                    await TicketSystemRepo.deleteTicketBySnowflake(message.id);
                    try {
                        await channel.delete();
                    } catch (error) {
                        await errorLogHandle(error);
                    }
                } catch (error) {
                    if (error instanceof Error && error.message.includes("reason: time")) return;
                    await errorLogHandle(error);
                    // as the ticket channel will be deleted, there is no follow up message
                }
            } else if (buttonInteraction.customId === "claim") {
                // the claim doesn't functionally do anything.
                // the room for implementation is there, but as is, it only servers as a notification
                // for the member that opened the ticket that someone is looking into it

                // disable claiming again
                try {
                    await message.edit({
                        components: [
                            new ActionRowBuilder<ButtonBuilder>()
                                .addComponents(
                                    claim_button().setDisabled(true),
                                    resolve_button(),
                                    add_member_button(),
                                    remove_member_button()
                                )
                        ]
                    });
                } catch { /* do nothing */ }

                // send the claim confirmation
                await buttonInteraction.reply({
                    content: `${member ?? `<@${ticketTable.member}>`}`,
                    embeds: [
                        embed_message("Aqua",
                            `${moderator} claimed your ticket and will look into your issue.`,
                            "Ticket Claimed"
                        )
                    ]
                });
            } else if (
                buttonInteraction.customId === "add-member"
                || buttonInteraction.customId === "remove-member"
            ) {
                const interactionId = buttonInteraction.customId;
                // for add-member the member selected is given permissions
                // permissionToggle will be true and will enable permissions if id = add-member and it will be false for remove-member
                const permissionToggle = interactionId === "add-member";
                await buttonInteraction.showModal(select_member_modal());
                try {
                    const submit = await buttonInteraction.awaitModalSubmit({
                        filter: (i) => i.user.id === moderator.id,
                        time: 120_000
                    });

                    const user = Array.from(
                        submit
                            .fields
                            .getSelectedUsers("select-member", true)
                            .values())[0]!;

                    await channel.permissionOverwrites.edit(user.id, {
                        SendMessages: permissionToggle,
                        EmbedLinks: permissionToggle,
                        AttachFiles: permissionToggle,
                        ViewChannel: permissionToggle
                    });

                    if (permissionToggle) {
                        await channel.send(`${user.toString()} was added to ${channel}`);
                    } else {
                        await channel.send({ embeds: [embed_message("Red", `${user} was removed from ${channel}`)] })
                    }

                    await submit.reply({
                        flags: MessageFlags.Ephemeral,
                        embeds: [embed_message("Green", `${user} selected.`)]
                    });
                } catch (error) {
                    await handleModalCatch(error);
                }
            } else {
                // reaching this else branch is a bug
                throw new Error(`${guild.name} [${guild.id}] | Ticket Message Snowflake: ${message.id} | Unknown button interaction.`)
            }

        },
        async () => {
            await TicketSystemRepo.deleteTicketBySnowflake(message.id); // clean the row
        }
    )
}