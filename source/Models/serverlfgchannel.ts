import type { Result } from "pg";

import database from '../Config/database.js';
import type { GuildChannelWithType } from "../Interfaces/database_types.js";

export default async function ServerLfgChannel(): Promise<Result<GuildChannelWithType>> {
    try{
        const result: Result<GuildChannelWithType> = await database.query(
            `CREATE TABLE IF NOT EXISTS serverlfgchannel(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                channel BIGINT NOT NULL,
                channeltype TEXT NOT NULL,
                CONSTRAINT unique_guild_channel UNIQUE(guild, channel),
                CONSTRAINT unique_guild_channeltype UNIQUE(guild, channeltype)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}