import type { Snowflake } from "discord.js";
import { SelfCache } from "../Config/SelfCache.js";
import database from "../Config/database.js";
import { GuildPlanTable } from "../Interfaces/database_types.js";

const guildPlanCache = new SelfCache<string, GuildPlanTable>();

class GuildPlanRepository {
    /**
     * Initialize or reset guild plan to default values (free permanent plan)
     * @param guildId Guild Snowflake
     */
    async default(guildId: Snowflake): Promise<void> {
        await database.query(
            `INSERT INTO guildplan(guild, plan, plansince, expiresat)
                VALUES ($1, 'free', EXTRACT(EPOCH FROM now())::BIGINT, NULL)
                ON CONFLICT (guild)
                DO UPDATE SET
                    plan = EXCLUDED.plan,
                    plansince = EXCLUDED.plansince,
                    expiresat = EXCLUDED.expiresat`,
            [guildId]
        );

        const cache: GuildPlanTable = {
            guild: guildId,
            plan: "free",
            planSince: String(Math.floor(Date.now() / 1000)),
            expiresAt: null
        }

        guildPlanCache.set(guildId, cache);
    }

    /**
     * Upgrades a free plan guild to a premium one
     * @param guildId Guild Snowflake
     * @param duration Duration of premiumship in seconds (no duration means permanent plan)
     */
    async setPremium(guildId: Snowflake, duration?: number): Promise<void> {
        const cache: GuildPlanTable = {
            guild: guildId,
            plan: "premium",
            planSince: String(Math.floor(Date.now() / 1000)),
            expiresAt: duration ? String(Math.floor(Date.now() / 1000) + duration) : null
        }

        await database.query(
            `UPDATE guildplan SET plan='premium', plansince=EXTRACT(EPOCH FROM now())::BIGINT, expiresat=$2
                WHERE guild=$1`,
            [guildId, cache.expiresAt]
        );

        guildPlanCache.set(guildId, cache);
    }

    /**
     * Fetches the guild plan, if it doesn't exist, GuildPlanRepo.default is called and the default object (free plan) 
     * is returned 
     * @param guildId Guild Snowflake
     * @returns GuildPlanTable object
     */
    async getGuildPlan(guildId: Snowflake): Promise<GuildPlanTable> {
        const cache = guildPlanCache.get(guildId);
        if(cache !== undefined) return cache;

        const {rows: data} = await database.query<GuildPlanTable>(`SELECT * FROM guildplan WHERE guild=$1`, [ guildId ]);
        if(data.length && data[0]) {
            guildPlanCache.set(guildId, {
                guild: data[0].guild,
                plan: data[0].plan,
                planSince: data[0].planSince,
                expiresAt: data[0].expiresAt
            });

            return data[0];
        } else {
            await this.default(guildId);
            const cacheDefault: GuildPlanTable = {
                guild: guildId,
                plan: "free",
                planSince: String(Math.floor(Date.now() / 1000)),
                expiresAt: null
            }
            guildPlanCache.set(guildId, cacheDefault);
            return cacheDefault;
        }
    }
}

const GuildPlanRepo = new GuildPlanRepository();
export default GuildPlanRepo;