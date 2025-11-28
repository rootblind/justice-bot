import type { Result } from "pg";

import database from '../Config/database.js';
import type { GuildChannelTable } from "../Interfaces/database_types.js";

export default async function ServerIgnoreLogs(): Promise<Result<GuildChannelTable>> {
    try{
        const result: Result<GuildChannelTable> = await database.query(
            `CREATE TABLE IF NOT EXISTS serverlogsignore (
              id SERIAL PRIMARY KEY,
              guild BIGINT NOT NULL,
              channel BIGINT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}