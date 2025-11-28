import type { Result } from "pg";

import database from '../Config/database.js';
import type { CustomReact } from "../Interfaces/database_types.js";

export default async function CustomReact(): Promise<Result<CustomReact>> {
    try{
        const result: Result<CustomReact> = await database.query(
            `CREATE TABLE IF NOT EXISTS customreact(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                keyword TEXT NOT NULL,
                reply TEXT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}