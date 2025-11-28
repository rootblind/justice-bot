import type { Result } from "pg";

import database from '../Config/database.js';
import type { ReactionRoles } from "../Interfaces/database_types.js";

export default async function ReactionRoles(): Promise<Result<ReactionRoles>> {
    try{
        const result: Result<ReactionRoles> = await database.query(
            `CREATE TABLE IF NOT EXISTS reactionroles (
              id SERIAL PRIMARY KEY,
              guild BIGINT NOT NULL,
              channel BIGINT NOT NULL,
              messageid BIGINT NOT NULL,
              roleid BIGINT NOT NULL,
              emoji TEXT NOT NULL
          )`
        );
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}