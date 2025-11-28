import type { Result } from "pg";

import database from '../Config/database.js';
import type { PremiumMembers } from "../Interfaces/database_types.js";

export default async function PremiumMembers(): Promise<Result<PremiumMembers>> {
    try{
        const result: Result<PremiumMembers> = await database.query(
            `CREATE TABLE IF NOT EXISTS premiummembers (
              id SERIAL PRIMARY KEY,
              member BIGINT NOT NULL,
              guild BIGINT NOT NULL,
              code BYTEA NOT NULL,
              customrole BIGINT,
              from_boosting BOOLEAN DEFAULT FALSE,
              CONSTRAINT unique_guild_member UNIQUE (guild, member)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}