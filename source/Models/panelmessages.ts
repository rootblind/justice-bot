import type { Result } from "pg";

import database from '../Config/database.js';
import type { PanelMessages } from "../Interfaces/database_types.js";

export default async function PanelMessages(): Promise<Result<PanelMessages>> {
    try{
        const result: Result<PanelMessages> = await database.query(
            `CREATE TABLE IF NOT EXISTS panelmessages (
              id SERIAL PRIMARY KEY,
              guild BIGINT NOT NULL,
              channel BIGINT NOT NULL,
              messageid BIGINT NOT NULL,
              panelname VARCHAR(32) NOT NULL
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}