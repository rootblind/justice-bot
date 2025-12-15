import type { Snowflake } from "discord.js";
import database from "../Config/database.js";

class CustomReactRepository {
    /**
     * @param guildId Guild Snowflake 
     * @param keyword The keyword to fetch
     * @returns The reply to the keyword if there is one set
     */
    async getKeywordReply(guildId: Snowflake, keyword: string): Promise<string | null> {
        const {rows: reaction} = await database.query(
            `SELECT reply FROM customreact WHERE guild=$1 AND keyword=$2`,
            [guildId, keyword]
        );

        if(reaction.length) {
            return reaction[0].reply;
        } else {
            return null;
        }
    }
}

const CustomReactRepo = new CustomReactRepository();
export default CustomReactRepo;