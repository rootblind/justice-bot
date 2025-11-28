import type { Result } from "pg";

import database from '../Config/database.js';
import type { PartyHistory } from "../Interfaces/database_types.js";

export default async function PartyHistory(): Promise<Result<PartyHistory>> {
    try{
        const result: Result<PartyHistory> = await database.query(
            `CREATE TABLE IF NOT EXISTS partyhistory(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                owner BIGINT NOT NULL,
                ign TEXT NOT NULL,
                region TEXT NOT NULL,
                gamemode INT NOT NULL,
                size INT NOT NULL,
                private BOOLEAN DEFAULT true NOT NULL,
                minrank INT,
                maxrank INT,
                reqroles TEXT[],
                description TEXT,
                timestamp BIGINT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}