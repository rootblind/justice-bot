import type { Result } from "pg";

import database from '../Config/database.js';
import type { GuildPlanTable } from "../Interfaces/database_types.js";

export default async function GuildPlanTable(): Promise<Result<GuildPlanTable>> {
    try{
        const result: Result<GuildPlanTable> = await database.query(
            `CREATE TABLE IF NOT EXISTS guildplan(
                guild BIGINT PRIMARY KEY,
                plan TEXT NOT NULL DEFAULT 'free',
                plansince BIGINT NOT NULL
                    DEFAULT EXTRACT(EPOCH FROM now())::BIGINT,
                expiresat BIGINT
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}