import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { WelcomeScheme } from "../Interfaces/database_types.js";
import { SelfCache } from "../Config/SelfCache.js";

const welcomeSchemeCache = new SelfCache<Snowflake, WelcomeScheme | null>(24 * 60 * 60_000);

class WelcomeSchemeRepository {
    async getScheme(guildId: Snowflake): Promise<WelcomeScheme | null> {
        const cache = welcomeSchemeCache.get(guildId);
        if(cache !== undefined) return cache;

        const {rows: scheme} = await database.query(
            `SELECT * FROM welcomescheme WHERE id=$1`,
            [guildId]
        );

        if(scheme.length) {
            welcomeSchemeCache.set(guildId, scheme[0]);
            return scheme[0];
        } else {
            welcomeSchemeCache.set(guildId, null);
            return null;
        }
    }
}

const WelcomeSchemeRepo = new WelcomeSchemeRepository();
export default WelcomeSchemeRepo;