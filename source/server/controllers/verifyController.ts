import type { Request, Response } from "express";
import { RiskAction, RiskAssessment, VerificationStatusType } from "../../Interfaces/server_types.js";
import { Client } from "discord.js";
import { fetchGuild } from "../../utility_modules/discord_helpers.js";

interface VerificationAssessmentResponse {
    success: boolean,
    verification_status: VerificationStatusType,
    banned?: boolean
}

export const verificationAssessment =
    async (req: Request, res: Response, client: Client) => {
        const { decision, risk, guild_id } = req.body;
        const guild = await fetchGuild(client, String(guild_id));

        if (!guild) {
            return res.status(400).json({ success: false, member: null, error: "Invalid guild_id" });
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

        switch (decision) {
            // allow and additional_verification are auto allow
            // verification status can be changed manually by an administrator
            // denial of verification at any point results in a ban
            case "allow": {
                // log in userlogs
                // the user gets verified with allow
                return res.status(200).json({
                    success: true,
                    verification_status: "allow"
                });

            }
            case "additional_verification": {
                // log in #assessment with risk assessment details included
                // the user gets verified with allow
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