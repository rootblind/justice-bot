import { Result } from "pg";
import database from "../Config/database.js";
import { DailyMessageObject } from "../Interfaces/database_types.js";

export default async function DailyMessage(): Promise<Result<DailyMessageObject>> {
    try {
        const result: Result<DailyMessageObject> = await database.query(
            `CREATE TABLE IF NOT EXISTS dailymessage(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                channel BIGINT NOT NULL,
                messageid BIGINT NOT NULL,
                message TEXT NOT NULL,
                schedule TEXT NOT NULL,

                UNIQUE (guild, messageid)
            )`
        );

        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
}