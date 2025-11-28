import type { Result } from "pg";

import database from '../Config/database.js';
import type { AutoVoiceCd } from "../Interfaces/database_types.js";

export default async function AutoVoiceCd(): Promise<Result<AutoVoiceCd>> {
    try{
        const result: Result<AutoVoiceCd> = await database.query(
            `CREATE TABLE IF NOT EXISTS autovoicecd(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                member BIGINT NOT NULL,
                expires BIGINT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}