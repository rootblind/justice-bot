import type { Result } from "pg";

import database from '../Config/database.js';
import type { AutoVoiceManager } from "../Interfaces/database_types.js";

export default async function AutoVoiceManager(): Promise<Result<AutoVoiceManager>> {
    try{
        const result: Result<AutoVoiceManager> = await database.query(
            `CREATE TABLE IF NOT EXISTS autovoicemanager(
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