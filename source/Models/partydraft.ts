import type { Result } from "pg";

import database from '../Config/database.js';
import type { PartyDraft } from "../Interfaces/database_types.js";

// a party draft is the state of a lfg when it was saved
// a member can create an lfg that they know they will use often and save it once and make the process faster next time

export default async function PartyDraft(): Promise<Result<PartyDraft>> {
    try{
        const result: Result<PartyDraft> = await database.query(
            `CREATE TABLE IF NOT EXISTS partydraft(
                id SERIAL PRIMARY KEY,
                slot INT NOT NULL,
                draftname TEXT NOT NULL,
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
                hexcolor INT,
                CONSTRAINT unique_guild_owner_slot UNIQUE(guild, owner, slot)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}