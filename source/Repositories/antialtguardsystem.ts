import database from "../Config/database.js";
import { AntiAltGuardSetupObj, AntiAltGuardSetupRow, PendingVerificationRow } from "../Interfaces/database_types.js";
import { timestampNow } from "../utility_modules/utility_methods.js";

class AntiAltGuardRepository {

    async getGuildSetup(guildId: string): Promise<AntiAltGuardSetupRow | null> {
        const { rows: data } = await database.query<AntiAltGuardSetupRow>(
            `SELECT * FROM antialtguard_setup WHERE guild=$1;`,
            [guildId]
        );

        return data[0] ?? null;
    }

    async fetchAllSetups(): Promise<AntiAltGuardSetupRow[]> {
        const { rows: data } = await database.query<AntiAltGuardSetupRow>(
            `SELECT * FROM antialtguard_setup;`
        );

        return data;
    }

    async upsertSetup(newRow: AntiAltGuardSetupObj): Promise<AntiAltGuardSetupRow> {
        const { rows: result } = await database.query<AntiAltGuardSetupRow>(
            `INSERT INTO antialtguard_setup (
                guild, 
                category, 
                verification_channel, 
                verification_message_menu, 
                assessment_channel, 
                verified_role
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (guild)
            DO UPDATE SET
                category = EXCLUDED.category,
                verification_channel = EXCLUDED.verification_channel,
                verification_message_menu = EXCLUDED.verification_message_menu,
                assessment_channel = EXCLUDED.assessment_channel,
                verified_role = EXCLUDED.verified_role

            RETURNING *;
            `,
            [
                newRow.guild,
                newRow.category,
                newRow.verification_channel,
                newRow.verification_message_menu,
                newRow.assessment_channel,
                newRow.verified_role
            ]
        );

        return result[0]!;
    }

    async deleteSetup(guildId: string) {
        await database.query(`DELETE FROM antialtguard_setup WHERE guild=$1`, [guildId]);
    }

    async addPendingVerification(messageId: string, channelId: string, memberId: string): Promise<PendingVerificationRow> {
        const DAY_IN_SECONDS = 24 * 60 * 60;
        const expirationDays = 3;
        const expiresAt = timestampNow() + (DAY_IN_SECONDS * expirationDays);
        const { rows: response } = await database.query<PendingVerificationRow>(
            `INSERT INTO antialtguard_pending_verification (messageid, channel, member, expiresat)
                VALUES ($1, $2, $3, $4)
                RETURNING *;`,
            [messageId, channelId, memberId, expiresAt]
        );

        return response[0]!;
    }

    async deletePendingVerification(messageOrMemberId: string) {
        await database.query(
            `DELETE FROM antialtguard_pending_verification WHERE messageid=$1 OR member=$1`,
            [messageOrMemberId]
        );
    }

    /**
     * Pending verifications expire in 3 days
     */
    async deleteExpiredPendingVerifications() {
        await database.query(
            `DELETE FROM antialtguard_pending_verification
            WHERE expiresat <= $1`,
            [timestampNow()]
        );
    }

    async getPendingVerification(messageOrMemberId: string): Promise<PendingVerificationRow | null> {
        const { rows: data } = await database.query<PendingVerificationRow>(
            `SELECT * FROM antialtguard_pending_verification
            WHERE messageid=$1 OR member=$1`,
            [messageOrMemberId]
        );

        return data[0] ?? null;
    }

    /**
     * Fetch all pending verifications with the corresponding guild attached.
     * 
     * Used mainly for the collector attachment on #assessment
     */
    async fetchPendingVerifications(): Promise<(PendingVerificationRow & { guild: string })[]> {
        const { rows: data } = await database.query<(PendingVerificationRow & { guild: string })>(
            `SELECT 
                pv.*,
                s.guild
            FROM antialtguard_pending_verification AS pv
            INNER JOIN antialtguard_setup AS s
                ON pv.channel = s.assessment_channel;`
        );

        return data;
    }

    async onSystemComponentDelete(guildId: string, componentSnowflake: string) {
        await database.query(
            `DELETE FROM antialtguard_setup 
            WHERE
                guild=$1
                AND (
                    category=$2 
                    OR verification_channel=$2 
                    OR assessment_channel=$2 
                    OR verification_message_menu=$2
                    OR verified_role=$2
                )`,
            [guildId, componentSnowflake]
        );

        await database.query(
            `DELETE FROM antialtguard_pending_verification WHERE messageid=$1`,
            [componentSnowflake]
        );
    }
};

const AntiAltGuardRepo = new AntiAltGuardRepository();
export default AntiAltGuardRepo;