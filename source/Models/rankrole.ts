import type { Result } from "pg";

import database from '../Config/database.js';
import type { RankRole } from "../Interfaces/database_types.js";

// ranks will be represented by integers from 0 to 9 iron -> challenger
// ranked queue solo/duo will be represented by 0 and flex queue will be represented by 1

export default async function RankRole(): Promise<Result<RankRole>> {
    try{
        const result: Result<RankRole> = await database.query(
            `CREATE TABLE IF NOT EXISTS rankrole(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                rankid INT NOT NULL,
                rankq INT NOT NULL,
                role BIGINT NOT NULL UNIQUE,
                CONSTRAINT unique_guild_role_rankq UNIQUE(guild, role, rankq),
                CONSTRAINT unique_guild_rankid_role UNIQUE(guild, role, rankid),
                CONSTRAINT unique_guild_rankid_rankq UNIQUE(guild, rankq, rankid)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}