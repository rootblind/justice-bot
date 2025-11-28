import type { Result } from "pg";

import database from '../Config/database.js';
import type { TicketSubject } from "../Interfaces/database_types.js";

export default async function TicketSubject(): Promise<Result<TicketSubject>> {
    try{
        const result: Result<TicketSubject> = await database.query(
            `CREATE TABLE IF NOT EXISTS ticketsubject(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                subject TEXT NOT NULL,
                description TEXT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}