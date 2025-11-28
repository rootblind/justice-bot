import type { Result } from "pg";

import database from '../Config/database.js';
import type { PremiumKey } from "../Interfaces/database_types.js";

export default async function PremiumKey(): Promise<Result<PremiumKey>> {
    try{
        const result: Result<PremiumKey> = await database.query(
            `CREATE TABLE IF NOT EXISTS premiumkey (
              id SERIAL PRIMARY KEY,
              code BYTEA NOT NULL,
              guild BIGINT NOT NULL,
              generatedby BIGINT NOT NULL,
              createdat BIGINT NOT NULL,
              expiresat BIGINT NOT NULL,
              usesnumber INT NOT NULL,
              dedicateduser BIGINT,
              CONSTRAINT unique_guild_dedicateduser UNIQUE (guild, dedicateduser)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}