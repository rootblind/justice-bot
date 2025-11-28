import type { Result } from "pg";

import database from '../Config/database.js';
import type { PunishLogs } from "../Interfaces/database_types.js";

// punishment_type is an integer representing the type of the punishment
// for ease of reference in code, integers will be used to represent punishment types instead of strings
// types are graded from least severe to most severe
// 0- warn; 1- timeout; 2- tempban; 3- indefinite ban; 4- permanent ban

export default async function PunishLogs(): Promise<Result<PunishLogs>> {
    try{
        const result: Result<PunishLogs> = await database.query(
            `CREATE TABLE IF NOT EXISTS punishlogs (
                id SERIAL PRIMARY KEY,
                guild BIGINT NOT NULL,
                target BIGINT NOT NULL,
                moderator BIGINT NOT NULL,
                punishment_type INT NOT NULL,
                reason TEXT NOT NULL,
                timestamp BIGINT NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}