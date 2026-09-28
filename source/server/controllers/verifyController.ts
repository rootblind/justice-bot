import type { Request, Response } from "express";
import { RiskAction, RiskAssessment, VerificationStatusType } from "../../Interfaces/server_types.js";
import { ActionRowBuilder, ButtonBuilder, Client, TextChannel } from "discord.js";
import { fetchGuild, fetchGuildChannel, fetchGuildMember, fetchGuildRole, fetchLogsChannel } from "../../utility_modules/discord_helpers.js";
import AntiAltGuardRepo from "../../Repositories/antialtguardsystem.js";
import { embed_manual_review, embed_verified_member, manualReviewButtons } from "../../Systems/antialt_guard/components.js";
import { errorLogHandle } from "../../utility_modules/error_logger.js";
import { manual_review_collector } from "../../Systems/antialt_guard/collectors.js";
import ServerRolesRepo from "../../Repositories/serverroles.js";

interface VerificationAssessmentResponse {
    success: boolean,
    verification_status: VerificationStatusType,
    banned?: boolean
}

export const verificationAssessment =
    async (req: Request, res: Response, client: Client) => {
        const { decision, risk, guild_id } =
            req.body as {
                decision: RiskAction,
                risk: RiskAssessment,
                guild_id: string
            };

        const guild = await fetchGuild(client, String(guild_id));

        if (!guild) {
            return res.status(400).json({ success: false, member: null, error: "Invalid guild_id" });
        }

        const staffRoleId = await ServerRolesRepo.getGuildStaffRole(guild.id);
        if (!staffRoleId) {
            return res.status(500).json({
                success: false,
                error: "Failed to fetch staff role id."
            });
        }

        if (!isRiskAction(decision)) {
            return res.status(400).json({
                success: false,
                error: "Invalid decision; RiskAction string was expected."
            });
        }
        if (!isRiskAssessment(risk)) {
            return res.status(400).json({
                success: false,
                error: "Invalid RiskAssessment object"
            });
        }

        const member = await fetchGuildMember(guild, risk.accountId);
        const botMember = await guild.members.fetchMe();
        if (!member) {
            return res.status(400).json({
                success: false,
                error: "Failed to fetch the member from the risk.accountId provided."
            });
        }

        const antiAltGuard = await AntiAltGuardRepo.getGuildSetup(guild.id);
        if (!antiAltGuard) {
            return res.status(500).json({
                success: false,
                error: "No anti alt guard setup was found for this guild."
            });
        }

        const assessmentChannel = await fetchGuildChannel(guild, antiAltGuard.assessment_channel);
        if (!(assessmentChannel instanceof TextChannel)) {
            return res.status(500).json({
                success: false,
                error: "The assessment channel couldn't be fetched."
            });
        }

        const verifiedRole = await fetchGuildRole(guild, antiAltGuard.verified_role);
        if (!verifiedRole) {
            return res.status(500).json({
                success: false,
                error: "Failed to fetch the verification role from the database. Faulty row."
            });
        }

        const userLogs = await fetchLogsChannel(guild, "user-activity");

        switch (decision) {
            // allow and additional_verification are auto allow
            // verification status can be changed manually by an administrator
            // denial of verification at any point results in a ban
            case "allow": {
                // log in userlogs
                // the user gets verified with allow
                const embedResponse = embed_verified_member(
                    member,
                    "accepted",
                    risk,
                    botMember,
                );

                if (userLogs) {
                    await userLogs.send({
                        embeds: [embedResponse]
                    });
                }
                try {
                    await member.roles.add(verifiedRole);
                } catch (error) {
                    await errorLogHandle(error);
                    return res.status(500).json({
                        success: false,
                        error: "Something went wrong while trying to assign the role."
                    });
                }
                return res.status(200).json(
                    {
                        success: true,
                        verification_status: "accepted"
                    } as VerificationAssessmentResponse
                );

            }
            case "additional_verification": {
                // log in #assessment with risk assessment details included
                // the user gets verified with allow
                const embedResponse = embed_verified_member(
                    member,
                    "accepted",
                    risk,
                    botMember,
                );

                if (userLogs) {
                    await userLogs.send({
                        embeds: [embedResponse]
                    });
                }

                await assessmentChannel.send({
                    embeds: [embedResponse]
                });

                try {
                    await member.roles.add(verifiedRole);
                } catch (error) {
                    await errorLogHandle(error);
                    return res.status(500).json({
                        success: false,
                        error: "Something went wrong while trying to assign the role."
                    });
                }

                return res.status(200).json(
                    {
                        success: true,
                        verification_status: "accepted"
                    } as VerificationAssessmentResponse
                );

            }
            case "manual_review": {
                // log in #assessment with risk assessment details included
                // verification requires moderator evaluation
                // user is put on pending
                // if the pending period expires, the user can attempt to verify again
                const embedResponse = embed_verified_member(
                    member,
                    "pending",
                    risk
                );
                if (userLogs) {
                    await userLogs.send({
                        embeds: [embedResponse]
                    });
                }

                const reviewMessage = await assessmentChannel.send({
                    embeds: [
                        embedResponse,
                        embed_manual_review()
                    ],
                    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(manualReviewButtons())]
                });

                // register the message
                await AntiAltGuardRepo.addPendingVerification(
                    reviewMessage.id,
                    antiAltGuard.assessment_channel,
                    member.id
                );

                // attach collector
                await manual_review_collector(reviewMessage, staffRoleId);
                return res.status(200).json(
                    {
                        success: true,
                        verification_status: "pending"
                    } as VerificationAssessmentResponse
                );
            }
            case "deny_verification": {
                // log in #assessment with risk assessment details included
                // WHILE EXPERIMENTAL:
                // verification requires moderator evaluation
                // a denial is suggested in the assessment log
                // user is put on pending

                // when the system is fully tested and proofed for high confidence
                // users will be auto denied based on this assessment

                const embedResponse = embed_verified_member(
                    member,
                    "pending",
                    risk
                );
                if (userLogs) {
                    await userLogs.send({
                        embeds: [embedResponse]
                    });
                }

                const reviewMessage = await assessmentChannel.send({
                    embeds: [
                        embedResponse,
                        embed_manual_review()
                    ],
                    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(manualReviewButtons())]
                });

                // register the message
                await AntiAltGuardRepo.addPendingVerification(
                    reviewMessage.id,
                    antiAltGuard.assessment_channel,
                    member.id
                );

                // attach collector
                await manual_review_collector(reviewMessage, staffRoleId);

                return res.status(200).json(
                    {
                        success: true,
                        verification_status: "pending"
                    } as VerificationAssessmentResponse
                );
            }
        }
    }

function isRiskAssessment(value: unknown): value is RiskAssessment {
    if (!value || typeof value !== "object") return false;

    const v = value as Record<string, unknown>;

    return (
        typeof v.accountId === "string" &&
        typeof v.score === "number" &&
        typeof v.level === "string" &&
        typeof v.recommendedAction === "string" &&
        Array.isArray(v.evidence) &&
        Array.isArray(v.relatedAccountIds) &&
        typeof v.clusterSize === "number" &&
        typeof v.strongestFingerprintScore === "number" &&
        typeof v.relatedBannedAccount === "boolean" &&
        typeof v.strongFingerprintRelationship === "boolean"
    );
}

function isRiskAction(value: unknown): value is RiskAction {
    return (
        value === "allow" ||
        value === "additional_verification" ||
        value === "manual_review" ||
        value === "deny_verification"
    );
}