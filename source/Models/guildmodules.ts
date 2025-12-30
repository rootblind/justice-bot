import type { Result } from "pg";

import database from '../Config/database.js';
import type { GuildModules } from "../Interfaces/database_types.js";

export default async function GuildModules(): Promise<Result<GuildModules>> {
    try{
        const result: Result<GuildModules> = await database.query(
            `CREATE TABLE IF NOT EXISTS guildmodules(
                guild BIGINT PRIMARY KEY,
                disabled_groups TEXT[] DEFAULT '{}'
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}