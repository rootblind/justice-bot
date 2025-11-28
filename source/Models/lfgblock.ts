import type { Result } from "pg";

import database from '../Config/database.js';
import type { LfgBlock } from "../Interfaces/database_types.js";

// in guild G X blocks Y but if Y doesn't block back X, then when X unblocks Y there would be no row containing G, X, Y or G, Y, X
// if Y blocks back X in G, then both of them need to unblock in order to be able to join each other parties
// in G X cannot block Y twice, once is enough, but Y can block X in G while being block themself

export default async function LfgBlock(): Promise<Result<LfgBlock>> {
    try{
        const result: Result<LfgBlock> = await database.query(
            `CREATE TABLE IF NOT EXISTS lfgblock(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                blocker BIGINT NOT NULL,
                blocked BIGINT NOT NULL,
                CONSTRAINT unique_guild_blocker_blocked UNIQUE(guild, blocker, blocked)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}