import {
    Collection,
    ComponentType,
    GuildMember,
    Message,
    MessageFlags
} from "discord.js";
import {
    fetchGuildMember,
    fetchGuildRole,
    fetchLogsChannel,
    message_collector
} from "../../utility_modules/discord_helpers.js";
import {
    duration_to_milliseconds,
    hasCooldownSeconds,
    timestampNow
} from "../../utility_modules/utility_methods.js";
import {
    embed_error,
    embed_message
} from "../../utility_modules/embed_builders.js";
import AntiAltGuardRepo from "../../Repositories/antialtguardsystem.js";
import webapi from "../../Config/webapi.js";
import { PendingVerificationRow } from "../../Interfaces/database_types.js";
import { VerificationStatusType } from "../../Interfaces/server_types.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { ban_handler } from "../moderation/ban_system.js";
import { embed_verified_member } from "./components.js";

export async function attach_aa_guard_status_collector(message: Message<boolean>) {
    const COOLDOWN = 60; // 1 minute
    const cooldowns = new Collection<string, number>();

    const collector = await message_collector<ComponentType.Button>(message,
        {
            componentType: ComponentType.Button,
        },
        async (buttonInteraction) => {
            const userCooldown = hasCooldownSeconds(buttonInteraction.user.id, cooldowns, COOLDOWN);
            if (userCooldown) {
                await buttonInteraction.reply({
                    embeds: [
                        embed_message("Red", `This button is on cooldown! <t:${userCooldown}:R>`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
            cooldowns.set(buttonInteraction.user.id, timestampNow());
            setTimeout(() => cooldowns.delete(buttonInteraction.user.id), COOLDOWN * 1000);

            const member = buttonInteraction.member as GuildMember;
            const guild = member.guild;
            const setupRow = await AntiAltGuardRepo.getGuildSetup(guild.id);
            if (!setupRow) {
                await buttonInteraction.reply({
                    embeds: [embed_error("It seems the setup disappeared during this session...")],
                    flags: MessageFlags.Ephemeral
                });
                collector.stop();
                return;
            }

            const verifiedRole = await fetchGuildRole(guild, setupRow.verified_role);
            if (!verifiedRole) {
                await buttonInteraction.reply({
                    embeds: [embed_error("It seems the verified role disappeared during this session...")],
                    flags: MessageFlags.Ephemeral
                });
                collector.stop();
                return;
            }
            await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });
            if (buttonInteraction.customId === "status-button") {
                const response = await webapi.get<
                    {
                        success: boolean,
                        verification_status: VerificationStatusType | null,
                        error?: string
                    }>
                    (
                        "/verify/request_status",
                        {
                            params: {
                                user_id: member.id
                            }
                        }
                    );

                if (response.data.success === true) {
                    if (response.data.verification_status === "accepted") {
                        try {
                            await member.roles.add(verifiedRole);
                            await buttonInteraction.editReply({
                                embeds: [embed_message("Green", "You were already verified, you've been granted access.")]
                            });
                        } catch (error) {
                            await errorLogHandle(error);
                            await buttonInteraction.editReply({
                                embeds: [embed_error("An error occured while assigning the verified role to you...")]
                            });
                        }
                    } else if (response.data.verification_status === "pending") {
                        await buttonInteraction.editReply({
                            embeds: [embed_message(
                                "Aqua",
                                "Your verification requires manual review and is on pending. " +
                                "Please wait until a staff member has time to review it."
                            )]
                        });
                    } else if (response.data.verification_status === null) {
                        await buttonInteraction.editReply({
                            embeds: [embed_message("Red", "You are not verified! Please press the `Verify` button and proceed.")]
                        });
                    }
                } else {
                    await buttonInteraction.editReply({
                        embeds: [embed_error(`Bad response: ${response.status} | ${response.data.error}`)]
                    });
                }
            }
        },
        async () => { }
    );

    return collector;
}

export async function manual_review_collector(
    message: Message<boolean>,
    staffRoleId: string
) {
    const cooldowns: Collection<string, number> = new Collection<string, number>();
    const CD = 3; // 3 seconds
    const collector = await message_collector<ComponentType.Button>(
        message,
        {
            componentType: ComponentType.Button,
            filter: (i) => (i.member as GuildMember).roles.cache.has(staffRoleId),
            time: duration_to_milliseconds("3d")!
        },
        async (buttonInteraction) => {

            const moderator = buttonInteraction.member as GuildMember;
            const guild = moderator.guild;

            const userCooldown = hasCooldownSeconds(moderator.id, cooldowns, CD);
            if (userCooldown) {
                await buttonInteraction.reply({
                    embeds: [
                        embed_message("Red", `This action is on cooldown! <r:${userCooldown}:R>`)
                    ],
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const antiAltGuard = await AntiAltGuardRepo.getGuildSetup(guild.id);
            if (!antiAltGuard) {
                await buttonInteraction.reply({
                    embeds: [embed_error("Antialt guard setup is missing...")],
                    flags: MessageFlags.Ephemeral
                });
                collector.stop();
                return;
            }

            const pendingVerificationRow: PendingVerificationRow | null =
                await AntiAltGuardRepo.getPendingVerification(message.id);

            if (!pendingVerificationRow) {
                await buttonInteraction.reply({
                    embeds: [embed_error("Failed to fetch the pending verification row.")],
                    flags: MessageFlags.Ephemeral
                });
                collector.stop();
                return;
            }

            await buttonInteraction.deferReply({ flags: MessageFlags.Ephemeral });

            const verifiedRole = await fetchGuildRole(guild, antiAltGuard.verified_role);
            if (!verifiedRole) {
                await buttonInteraction.editReply({
                    embeds: [embed_error("Verified role is missing...")]
                });
                collector.stop();
                return;
            }

            const member = await fetchGuildMember(guild, pendingVerificationRow.member);
            if (!member) {
                await buttonInteraction.editReply({
                    embeds: [embed_error("Failed to fetch the pending member...")]
                });
                collector.stop();
                return;
            }

            const userLogs = await fetchLogsChannel(guild, "user-activity");

            switch (buttonInteraction.customId) {
                case "allow-button": {
                    // grant access
                    try {
                        await member.roles.add(verifiedRole);
                    } catch (error) {
                        await errorLogHandle(error);
                        await buttonInteraction.editReply({
                            embeds: [embed_error("Something went wrong while assigning the verified role.")]
                        });
                        return;
                    }

                    // log
                    if (userLogs) {
                        await userLogs.send({
                            embeds: [
                                embed_verified_member(
                                    member,
                                    "accepted"
                                ).addFields(
                                    {
                                        name: "Moderator",
                                        value: moderator.toString()
                                    },
                                    {
                                        name: "Context",
                                        value: `[here](${message.url})`
                                    }
                                )
                            ]
                        });
                    }

                    await buttonInteraction.editReply({
                        embeds: [embed_message("Green", `${member} has been granted access.`)]
                    });
                    // remove the pending verification row
                    await AntiAltGuardRepo.deletePendingVerification(member.id);

                    // communicate this decision to the web endpoint
                    const status: VerificationStatusType = "accepted";
                    await webapi.post(
                        "/verify/manual_review",
                        {
                            user_id: member.id,
                            status: status
                        }
                    );

                    collector.stop();
                    break;
                }
                case "deny-button": {
                    // log
                    if (userLogs) {
                        await userLogs.send({
                            embeds: [
                                embed_verified_member(
                                    member,
                                    "denied"
                                ).addFields(
                                    {
                                        name: "Moderator",
                                        value: moderator.toString()
                                    },
                                    {
                                        name: "Context",
                                        value: `[here](${message.url})`
                                    }
                                )
                            ]
                        });
                    }

                    // denied members get banned
                    const modLogs = await fetchLogsChannel(guild, "moderation");
                    const punishmentType = 3; // indefinite ban
                    const deleteMessages = true;
                    await ban_handler(
                        guild,
                        member.user,
                        moderator.user,
                        punishmentType,
                        `Antialt guard manual review: Denied access. [assessment](${message.url})`,
                        deleteMessages,
                        undefined,
                        modLogs
                    );

                    await buttonInteraction.editReply({
                        embeds: [
                            embed_message("Red", `${member} was denied access. Has been banned as a result.`)
                        ]
                    });

                    // remove the pending verification row
                    await AntiAltGuardRepo.deletePendingVerification(member.id);

                    // communicate this decision to the web endpoint
                    const status: VerificationStatusType = "accepted";
                    await webapi.post(
                        "/verify/manual_review",
                        {
                            user_id: member.id,
                            status: status
                        }
                    );

                    collector.stop();
                    break;
                }
            }
        },
        async () => {
            try {
                await message.edit({ components: [] });
            } catch {/* do nothing */ }
        }
    )
}