import type { Snowflake } from "discord.js";
import database from "../Config/database.js";
import { WelcomeScheme } from "../Interfaces/database_types.js";

class WelcomeSchemeRepository {
    async getScheme(guildId: Snowflake): Promise<WelcomeScheme | null> {
        const {rows: scheme} = await database.query(
            `SELECT * FROM welcomescheme WHERE id=$1`,
            [guildId]
        );

        if(scheme.length) {
            return scheme[0];
        } else {
            return null;
        }
    }
}

const WelcomeSchemeRepo = new WelcomeSchemeRepository();
export default WelcomeSchemeRepo;