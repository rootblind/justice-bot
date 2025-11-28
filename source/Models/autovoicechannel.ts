import type { Result } from "pg";

import database from '../Config/database.js';
import type { GuildChannelWithType } from "../Interfaces/database_types.js";

export default async function AutoVoiceChannel(): Promise<Result<GuildChannelWithType>> {
    try{
        const result: Result<GuildChannelWithType> = await database.query(
            `CREATE TABLE IF NOT EXISTS autovoicechannel(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                channel BIGINT NOT NULL,
                type TEXT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}