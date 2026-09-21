// Interfaces and types associated with the API server of the bot for requests and responses

interface BanInfo {
    banned: boolean,
    moderator: string | null,
    expires: string | number,
    reason: string,
    timestamp: string | null,
    account_created_at: number
}

interface MemberInfo {
    // timestamps are in seconds
    avatar: string | null,
    joined_guild_at: number | null,
    account_created_at: number
}

export type {
    BanInfo,
    MemberInfo,
};

export interface RiskAssessment {
    readonly accountId: string;
    readonly score: number; // policy score from 0 to 100
    readonly level: RiskLevel;
    readonly recommendedAction: RiskAction;
    readonly evidence: readonly RiskEvidence[];
    // Accounts directly connected to the evaluated account.
    readonly relatedAccountIds: readonly string[];
    // Number of accounts in the connected fingerprint cluster.
    readonly clusterSize: number;
    // Highest fingerprint similarity involving this account.
    readonly strongestFingerprintScore: number;
    // True when at least one related account is currently banned.
    readonly relatedBannedAccount: boolean;

    // true when the fingerprint relationship itself is sufficiently strong
    // to be relevant for risk evaluation.
    readonly strongFingerprintRelationship: boolean;
}

export type RiskLevel =
    | "low"
    | "moderate"
    | "high"
    | "critical";

export type RiskAction =
    | "allow" // simply verify the user
    | "additional_verification" // verify the user but log the risk assessment
    | "manual_review" // log the assessment but require manual moderator verification, no verification given
    | "deny_verification"; // deny verification and ban the account

export interface RiskEvidence {
    readonly type: RiskEvidenceType;
    readonly points: number; // negative ++; positive --
    readonly description: string;
    readonly relatedAccountIds: readonly string[];
}

export type RiskEvidenceType =
    | "fingerprint_similarity"
    | "fingerprint_cluster"
    | "related_banned_account"
    | "related_verified_account"
    | "shared_email"
    | "guild_membership"
    | "account_age"
    | "historical_relationship"
    | "shared_ip"
    | "no_avatar"
    | "has_premium"
    | "young_account"
    | "joined_too_soon"
    | "joined_same_day"

export type VerificationStatusType = "pending" | "accepted" | "denied";