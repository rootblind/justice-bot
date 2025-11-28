import type { Result } from "pg";

import database from '../Config/database.js';
import type { StaffRoles } from "../Interfaces/database_types.js";

export default async function StaffRoles(): Promise<Result<StaffRoles>> {
    try{
        const result: Result<StaffRoles> = await database.query(
            `CREATE TABLE IF NOT EXISTS staffroles(
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                role BIGINT NOT NULL,
                roletype TEXT NOT NULL,
                position INT NOT NULL,
                CONSTRAINT staffroles_guild_role UNIQUE (guild, role)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}