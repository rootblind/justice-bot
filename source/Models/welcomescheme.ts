import type { Result } from "pg";

import database from '../Config/database.js';
import type { WelcomeScheme } from "../Interfaces/database_types.js";

export default async function WelcomeScheme(): Promise<Result<WelcomeScheme>> {
    try{
        const result: Result<WelcomeScheme> = await database.query(`CREATE TABLE IF NOT EXISTS welcomescheme (
              id bigint PRIMARY KEY,
              guild VARCHAR(32),
              active BOOLEAN DEFAULT false NOT NULL,
              channel VARCHAR(30),
              message VARCHAR(255),
              author BOOLEAN,
              title VARCHAR(255),
              colorcode VARCHAR(10),
              imagelink VARCHAR(255)
          )`);
        
        return result;
    } catch(error) {
        console.error(error);
        throw error;
    }
}