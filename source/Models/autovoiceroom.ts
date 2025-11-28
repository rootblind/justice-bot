import type { Result } from "pg";

import database from '../Config/database.js';
import type { AutoVoiceRoom } from "../Interfaces/database_types.js";

export default async function AutoVoiceRoom(): Promise<Result<AutoVoiceRoom>> {
    try{
        const result: Result<AutoVoiceRoom> = await database.query(
            `CREATE TABLE IF NOT EXISTS autovoiceroom(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                channel BIGINT NOT NULL,
                owner BIGINT NOT NULL,
                timestamp BIGINT NOT NULL,
                order_room INT NOT NULL,
                CONSTRAINT autovoice_guild_owner UNIQUE (guild, owner)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}