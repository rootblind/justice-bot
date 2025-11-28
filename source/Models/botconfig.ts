import type { Result } from "pg";

import database from '../Config/database.js';
import type { BotConfig } from "../Interfaces/database_types.js";

export default async function BotConfig(): Promise<Result<BotConfig>> {
    try{
        const result: Result<BotConfig> = await database.query(
            `CREATE TABLE IF NOT EXISTS botconfig (
                id BIGINT PRIMARY KEY,
                application_scope TEXT NOT NULL DEFAULT 'global',
                backup_db_schedule TEXT
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}