import type { Result } from "pg";

import database from '../Config/database.js';
import type { PanelScheme } from "../Interfaces/database_types.js";

export default async function PanelScheme(): Promise<Result<PanelScheme>> {
    try{
        const result: Result<PanelScheme> = await database.query(
            `CREATE TABLE IF NOT EXISTS panelscheme (
              id SERIAL PRIMARY KEY,
              guild BIGINT NOT NULL,
              panelname VARCHAR(32) NOT NULL,
              roleid BIGINT NOT NULL,
              description VARCHAR(255)
            )`
        );
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}