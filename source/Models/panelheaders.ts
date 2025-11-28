import type { Result } from "pg";

import database from '../Config/database.js';
import type { PanelHeaders } from "../Interfaces/database_types.js";

export default async function PanelHeaders(): Promise<Result<PanelHeaders>> {
    try{
        const result: Result<PanelHeaders> = await database.query(
            `CREATE TABLE IF NOT EXISTS panelheaders (
              id SERIAL PRIMARY KEY,
              guild BIGINT NOT NULL,
              panelname VARCHAR(32) NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}