import { Snowflake } from "discord.js";
import database from "../Config/database.js";
import type { EventGuildLogsString } from "../Interfaces/database_types.js";

class ServerLogsRepository {
    /**
     * 
     * @param guildId Guild Snowflake
     * @param event EventGuildLogs type string, the event type log channel
     * @returns The specified channel snowflake or null if there is no row to match the guild and event
     */
    async getGuildEventChannel(guildId: Snowflake, event: EventGuildLogsString): Promise<Snowflake | null> {
        const {rows: logsData} = await database.query(
            `SELECT channel FROM serverlogs WHERE guild=$1 AND eventtype=$2`, [guildId, event]
        );

        if(logsData.length) {
            return logsData[0].channel;
        } else {
            return null;
        }
    }
}

const ServerLogsRepo = new ServerLogsRepository();
export default ServerLogsRepo;