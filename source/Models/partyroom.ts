import type { Result } from "pg";

import database from '../Config/database.js';
import type { PartyRoom } from "../Interfaces/database_types.js";

export default async function PartyRoom(): Promise<Result<PartyRoom>> {
    try{
        const result: Result<PartyRoom> = await database.query(
            `CREATE TABLE IF NOT EXISTS partyroom(
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
                channel BIGINT NOT NULL UNIQUE,
                message BIGINT NOT NULL,
                hexcolor INT DEFAULT 0,
                timestamp BIGINT NOT NULL,
                CONSTRAINT unique_owner_guild UNIQUE(guild, owner)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}