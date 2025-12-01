import type { Snowflake } from "discord.js";
import database from "../Config/database.js";

class PremiumKeyRepository {
    /**
     * @param guildId Guild snowflake
     * @returns Array of all codes as hex strings from the specified guild (codes are scored encrypted)
     */
    async getAllGuildCodes(guildId: Snowflake): Promise<string[]> {
        const {rows: codes} = await database.query(
            `SELECT code FROM premiumkey WHERE guild=$1`,
            [guildId]
        );

        return codes.map(row => row.code.toString("hex"));
    }

    /**
     * Register a new key to the database
     * 
     * @param code hex string
     * @param guildId Guild Snowflake
     * @param generatedBy The snowflake of the member that generated the code
     * @param expiresAt The timestamp when the code expires, set it to 0 to not expire
     * @param usesnumber How many uses the code has left. Set to 0 for from_boosting membership
     * @param dedicateduser The snowflake of the user that can claim the code. Defaults to null meaning anyone can claim the code.
     */
    async newKey(
        code: string,
        guildId: Snowflake,
        generatedBy: Snowflake,
        expiresAt: number | string,
        usesnumber: number,
        dedicateduser: Snowflake | null = null
    ): Promise<void> {
        await database.query(
            `INSERT INTO premiumkey(code, guild, generatedby, createdat, expiresat, usesnumber, dedicateduser)
                VALUES($1, $2, $3, $4, $5, $6, $7)`,
            [code, guildId, generatedBy, Math.floor(Date.now() / 1000), expiresAt, usesnumber, dedicateduser]
        );
    }

    /**
     * Deletes all entries of expired keys
     */
    async clearExpiredKeys() {
        await database.query(
            `DELETE FROM premiumkey WHERE expiresat <= $1 AND expiresat > 0`,
            [Math.floor(Date.now() / 1000)]
        );
    }
}

const PremiumKeyRepo = new PremiumKeyRepository();
export default PremiumKeyRepo;