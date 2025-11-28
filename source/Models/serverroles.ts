import type { Result } from "pg";

import database from '../Config/database.js';
import type { ServerRoles } from "../Interfaces/database_types.js";

export default async function ServerRoles(): Promise<Result<ServerRoles>> {
    try{
        const result: Result<ServerRoles> = await database.query(
            `CREATE TABLE IF NOT EXISTS serverroles (
                  id SERIAL PRIMARY KEY,
                  guild BIGINT NOT NULL,
                  roletype TEXT NOT NULL,
                  role BIGINT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}