import type { Result } from "pg";

import database from '../Config/database.js';
import type { GuildChannelWithType } from "../Interfaces/database_types.js";

export default async function ServerLogs(): Promise<Result<GuildChannelWithType>> {
    try{
        const result: Result<GuildChannelWithType> = await database.query(
            `CREATE TABLE IF NOT EXISTS serverlogs (
              id SERIAL PRIMARY KEY,
              guild BIGINT NOT NULL,
              channel BIGINT NOT NULL,
              eventtype TEXT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}