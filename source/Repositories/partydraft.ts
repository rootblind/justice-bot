import type { Snowflake } from "discord.js";
import database from "../Config/database.js";

class PartyDraftRepository {
    /**
     * Deletes rows from a guild where he member uses premium slots
     * @param guildId Guild Snowflake
     * @param memberId Member/User Snowflake
     */
    async deleteGuildMemberPremiumDrafts(guildId: Snowflake, memberId: Snowflake): Promise<void> {
        await database.query(
            `DELETE FROM partydraft WHERE guild=$1 AND owner=$2 AND slot > 2`,
            [guildId, memberId]
        );
    }

    /**
     * Sets the hexcolor of the free slots (slot 1 and 2) to 0 (black, default) from the guild member
     * @param guildId Guild snowflake
     * @param memberId Member/User snowflake
     */
    async removeFreeSlotsColors(guildId: Snowflake, memberId: Snowflake): Promise<void> {
        await database.query(
            `UPDATE partydraft SET hexcolor=0 WHERE guild=$1 AND owner=$2 AND slot <= 2`,
            [guildId, memberId]
        );
    }
}

const PartyDraftRepo = new PartyDraftRepository();
export default PartyDraftRepo;