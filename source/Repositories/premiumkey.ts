import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";
import { PremiumKey } from "../Interfaces/database_types.js";

const premiumKeyCache = new SelfCache<string, PremiumKey>(60 * 60_000);

class PremiumKeyRepository {
    /**
     * @param guildId Guild snowflake
     * @returns Array of all codes as hex strings from the specified guild (codes are stored encrypted)
     */
    async getAllGuildCodes(guildId: Snowflake): Promise<string[]> {
        const cache = premiumKeyCache.getByValue((_, key) => key.startsWith(`${guildId}`));
        if(cache !== undefined) {
            return cache.map(key => key.code.toString("hex"));
        }

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
        const now: Snowflake = String(Math.floor(Date.now() / 1000));
        const premiumKey: PremiumKey = {
            id: 0,
            guild: guildId,
            code: Buffer.from(code, "hex"),
            generatedby: generatedBy,
            expiresat: String(expiresAt),
            createdat: now,
            usesnumber: usesnumber,
            dedicateduser: dedicateduser ? dedicateduser : null
        }

        const cacheKey = `${guildId}:${code}`;
        premiumKeyCache.set(cacheKey, premiumKey);

        await database.query(
            `INSERT INTO premiumkey(code, guild, generatedby, createdat, expiresat, usesnumber, dedicateduser)
                VALUES($1, $2, $3, $4, $5, $6, $7)`,
            [code, guildId, generatedBy, now, expiresAt, usesnumber, dedicateduser]
        );
    }

    /**
     * Deletes all entries of expired keys
     */
    async clearExpiredKeys() {
        const now = Math.floor(Date.now() / 1000);
        premiumKeyCache.deleteByValue((v) => Number(v.expiresat) <= now && Number(v.expiresat) > 0)
        await database.query(
            `DELETE FROM premiumkey WHERE expiresat <= $1 AND expiresat > 0`,
            [now]
        );
    }
}

const PremiumKeyRepo = new PremiumKeyRepository();
export default PremiumKeyRepo;