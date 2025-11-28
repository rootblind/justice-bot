import type { Result } from "pg";

import database from '../Config/database.js';
import type { TicketManager } from "../Interfaces/database_types.js";

export default async function TicketManager(): Promise<Result<TicketManager>> {
    try{
        const result: Result<TicketManager> = await database.query(
            `CREATE TABLE IF NOT EXISTS ticketmanager(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                category BIGINT NOT NULL,
                channel BIGINT NOT NULL,
                message BIGINT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}