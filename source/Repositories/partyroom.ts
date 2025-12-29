import { Snowflake } from "discord.js";
import { SelfCache } from "../Config/SelfCache.js";
import database from "../Config/database.js";
import { PartyRoom } from "../Interfaces/database_types.js";

const partyRoomCache = new SelfCache<string, PartyRoom | null>(15 * 60_000);

class PartyRoomRepository {
    /**
     * 
     * @param guildId Guild Snowflake
     * @param channelId Channel Snowflake
     * @returns PartyRoom object
     */
    async getPartyRoom(guildId: Snowflake, channelId: Snowflake): Promise<PartyRoom | null> {
        const key = `${guildId}:${channelId}`;
        const cache = partyRoomCache.get(key);
        if(cache !== undefined) return cache;

        const {rows: data} = await database.query(
            `SELECT * FROM partyroom WHERE guild=$1 AND channel=$2`,
            [guildId, channelId]
        );

        if(data.length) {
            partyRoomCache.set(key, data[0]);
            return data[0];
        } else {
            partyRoomCache.set(key, null);
            return null;
        }
    }
}

const PartyRoomRepo = new PartyRoomRepository();
export default PartyRoomRepo;