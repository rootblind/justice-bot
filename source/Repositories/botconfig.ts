import database from "../Config/database.js";
import type { BotConfig } from "../Interfaces/database_types.js";
import { get_env_var } from "../utility_modules/utility_methods.js";

class BotConfigRepository {
    async getConfig(): Promise<BotConfig | null> {
        const {rows: res} = await database.query(`SELECT * FROM botconfig`);
        
        if(res.length) {
            return res[0];
        } else {
            return null;
        }
    }

    async setDefault(): Promise<BotConfig | null> {
        const {rows: res} = await database.query(
            `INSERT INTO botconfig(id) VALUES($1) RETURNING *`,
            [ get_env_var("CLIENT_ID") ]
        );

        if(res.length) {
            return res[0];
        } else {
            return null;
        }
    }
}

const BotConfigRepo = new BotConfigRepository();

export default BotConfigRepo;