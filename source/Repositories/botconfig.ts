import database from "../Config/database.js";
import type { BotConfig } from "../Interfaces/database_types.js";
import { CronString } from "../Interfaces/helper_types.js";
import { get_env_var } from "../utility_modules/utility_methods.js";

class BotConfigRepository {
    /**
     * 
     * @returns Bot's current stored configuration
     */
    async getConfig(): Promise<BotConfig | null> {
        const {rows: res} = await database.query(`SELECT * FROM botconfig`);
        
        if(res.length) {
            return res[0];
        } else {
            return null;
        }
    }

    /**
     * 
     * @returns The backup schedule as CronString
     */
    async getBackupSchedule(): Promise<CronString | null> {
        const {rows: res} = await database.query(`SELECT backup_db_schedule FROM botconfig`);

        if(res.length && res[0].backup_db_schedule) {
            return res[0].backup_db_schedule as CronString
        } else {
            return null;
        }
    }

    /**
     * 
     * @returns Sets the default row for the bot's stored configuration
     */
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