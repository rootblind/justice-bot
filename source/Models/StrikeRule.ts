import type { Result } from "pg";

import database from '../Config/database.js';
import type { StrikeRule } from "../Interfaces/database_types.js";

export default async function StrikeRule(): Promise<Result<StrikeRule>> {
    try{
        const result: Result<StrikeRule> = await database.query(
            `CREATE TABLE IF NOT EXISTS strikerule(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                strikecount INT NOT NULL,
                punishment TEXT NOT NULL,
                CONSTRAINT strikerule_guild_strikecount UNIQUE (guild, strikecount)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}