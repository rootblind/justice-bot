import type { Result } from "pg";

import database from '../Config/database.js';
import type { GuildMessageTable } from "../Interfaces/database_types.js";

export default async function PartyMaker(): Promise<Result<GuildMessageTable>> {
    try{
        const result: Result<GuildMessageTable> = await database.query(
            `CREATE TABLE IF NOT EXISTS partymaker(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                message BIGINT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}