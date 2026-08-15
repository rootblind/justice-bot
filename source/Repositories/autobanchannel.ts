import database from "../Config/database.js";
import { SelfCache } from "../Config/SelfCache.js";
import { GuildChannelTable } from "../Interfaces/database_types";

const repoCache = new SelfCache<string, string>(); // using the guild as the key as there is only one row per guild

class AutoBanChannelRepository {
    /**
     * Upsert an autobanchannel for the guild
     */
    async put(guildId: string, channelId: string): Promise<GuildChannelTable & { id: number }> {
        const { rows: result } = await database.query<GuildChannelTable & { id: number }>(
            `INSERT INTO autobanchannel (guild, channel)
                VALUES ($1, $2)
                ON CONFLICT (guild, channel)
                DO UPDATE SET channel = EXCLUDED.channel
                RETURNING *;`,
            [guildId, channelId]
        );

        repoCache.set(guildId, channelId);

        return result[0]!; // inserting guarantees it
    }

    /**
     * Delete a row based on either 
     */
    async delete(snowflake: string): Promise<void> {
        const { rows: result } = await database.query<GuildChannelTable>(
            `DELETE FROM autobanchannel 
            WHERE guild=$1 OR channel=$1
            RETURNING *;
            `, [snowflake]);

        if (result && result[0]) {
            repoCache.delete(result[0].guild);
        }
    }

    /**
     * Returns the autobanchannel snowflake of the given guild id
     */
    async get(guildId: string): Promise<string | null> {
        const { rows: data } = await database.query<GuildChannelTable & { id: number }>(
            `SELECT * FROM autobanchannel WHERE guild=$1;`, [guildId]
        );

        return data[0]?.channel ?? null;
    }
};

const AutoBanChannelRepo = new AutoBanChannelRepository();

export default AutoBanChannelRepo;