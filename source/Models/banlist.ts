import type { Result } from "pg";

import database from '../Config/database.js';
import type { BanList } from "../Interfaces/database_types.js";

export default async function BanList(): Promise<Result<BanList>> {
    try{
        const result: Result<BanList> = await database.query(
            `CREATE TABLE IF NOT EXISTS banlist (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                target BIGINT NOT NULL,
                moderator BIGINT NOT NULL,
                expires BIGINT NOT NULL,
                reason TEXT NOT NULL,
                CONSTRAINT unique_guild_target UNIQUE (guild, target)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}