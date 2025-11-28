import type { Result } from "pg";

import database from '../Config/database.js';
import type { AutoPunishRule } from "../Interfaces/database_types.js";

export default async function AutoPunishRule(): Promise<Result<AutoPunishRule>> {
    try{
        const result: Result<AutoPunishRule> = await database.query(
            `CREATE TABLE IF NOT EXISTS autopunishrule(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                warncount INT NOT NULL,
                duration BIGINT NOT NULL,
                punishment_type INT NOT NULL,
                punishment_duration BIGINT NOT NULL,
                CONSTRAINT unique_warncount_duration_guild UNIQUE (guild, warncount, duration)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}