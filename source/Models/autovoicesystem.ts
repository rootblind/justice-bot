import type { Result } from "pg";

import database from '../Config/database.js';
import type { AutoVoiceSystem } from "../Interfaces/database_types.js";

export default async function AutoVoiceSystem(): Promise<Result<AutoVoiceSystem>> {
    try{
        const result: Result<AutoVoiceSystem> = await database.query(
            `CREATE TABLE IF NOT EXISTS autovoicesystem(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                category BIGINT NOT NULL,
                managerchannel BIGINT NOT NULL,
                autovoice BIGINT NOT NULL,
                message BIGINT NOT NULL,
                CONSTRAINT autovoicesystem_unique_guild_message UNIQUE (guild, message)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}