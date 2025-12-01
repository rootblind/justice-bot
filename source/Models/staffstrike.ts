import type { Result } from "pg";

import database from '../Config/database.js';
import type { StaffStrike } from "../Interfaces/database_types.js";

export default async function StaffStrike(): Promise<Result<StaffStrike>> {
    try{
        const result: Result<StaffStrike> = await database.query(
            `CREATE TABLE IF NOT EXISTS staffstrike(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                striked BIGINT NOT NULL,
                striker BIGINT NOT NULL,
                reason TEXT NOT NULL,
                expires BIGINT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}